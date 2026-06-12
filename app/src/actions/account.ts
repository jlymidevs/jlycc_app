// app/src/actions/account.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person, contactInfo } from "@/schema/core";
import {
  signupSchema,
  completeProfileSchema,
  updateProfileSchema,
} from "@/lib/validations/account";
import { address, personAddress } from "@/schema/core";
import { provisionMemberProfile } from "@/lib/provision";
import { requireRole } from "@/lib/authz-server";
import { and, eq, isNull } from "drizzle-orm";

/** YYYY-MM-DD in Asia/Manila — the app's operating timezone. */
function manilaToday(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "Asia/Manila" });
}
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Active ministry heads for the signup picker / re-request picker. */
export async function listActiveHeads() {
  return db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryName: ministry.name,
      headFirstName: person.firstName,
      headLastName: person.lastName,
    })
    .from(ministryMembership)
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt),
        eq(ministryChapter.status, "ACTIVE")
      )
    )
    .orderBy(ministry.name);
}

export async function signup(formData: FormData) {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: (formData.get("email") as string | null)?.toLowerCase().trim(),
    password: formData.get("password"),
    chapterId: formData.get("chapterId")
      ? Number(formData.get("chapterId"))
      : undefined,
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const [existing] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.email, d.email))
    .limit(1);
  if (existing) {
    return { errors: { email: ["An account with this email already exists"] } };
  }

  const passwordHash = await bcrypt.hash(d.password, 10);
  const [created] = await db
    .insert(users)
    .values({
      email: d.email,
      name: `${d.firstName} ${d.lastName}`,
      passwordHash,
      role: "MEMBER",
    })
    .returning({ userId: users.userId });

  const { memberId } = await provisionMemberProfile(
    created.userId,
    d.email,
    d.firstName,
    d.lastName
  );

  // Priority-1 join request to the chosen head's chapter.
  if (d.chapterId) {
    await db.insert(joinRequest).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: memberId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapterId: d.chapterId as any,
      priority: 1,
    });
  }

  redirect("/login?registered=1");
}

/** Shared helper: update person basics + upsert mobile contact. */
async function savePersonBasics(
  personId: number,
  d: {
    firstName: string;
    lastName: string;
    mobile?: string;
    dateOfBirth?: string;
    gender?: "MALE" | "FEMALE" | "UNDISCLOSED";
  }
) {
  await db
    .update(person)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      dateOfBirth: d.dateOfBirth ? d.dateOfBirth : null,
      gender: d.gender ?? null,
    })
    .where(eq(person.personId, personId));

  if (d.mobile) {
    const [existingMobile] = await db
      .select({ contactId: contactInfo.contactId })
      .from(contactInfo)
      .where(
        and(
          eq(contactInfo.personId, personId),
          eq(contactInfo.type, "MOBILE")
        )
      )
      .limit(1);
    if (existingMobile) {
      await db
        .update(contactInfo)
        .set({ value: d.mobile })
        .where(eq(contactInfo.contactId, existingMobile.contactId));
    } else {
      await db.insert(contactInfo).values({
        personId,
        type: "MOBILE",
        value: d.mobile,
        isPrimary: false,
      });
    }
  }
}

/**
 * Post-Google-signin profile completion (/welcome): update person details,
 * save mobile contact, optionally file a priority-1 ministry join request.
 */
export async function completeProfile(formData: FormData) {
  const session = await requireRole("MEMBER");
  const email = session.user?.email;
  if (!email) redirect("/login");

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    mobile: (formData.get("mobile") as string | null) ?? "",
    dateOfBirth: (formData.get("dateOfBirth") as string | null) ?? "",
    gender: formData.get("gender") || undefined,
    chapterId: formData.get("chapterId")
      ? Number(formData.get("chapterId"))
      : undefined,
  };
  const parsed = completeProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // Resolve (and if needed provision) the member profile for this account.
  const [u] = await db
    .select({ userId: users.userId, personId: users.personId, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) redirect("/login");
  let personId = u.personId;
  let memberId: number | null = null;
  if (personId == null) {
    const r = await provisionMemberProfile(u.userId, email, d.firstName, d.lastName);
    personId = r.personId;
    memberId = r.memberId;
  }

  await savePersonBasics(personId, d);

  await db
    .update(users)
    .set({ profileCompletedAt: new Date() })
    .where(eq(users.userId, u.userId));

  // Optional priority-1 ministry join request (skip if any request/membership exists).
  if (d.chapterId) {
    if (memberId == null) {
      const [m] = await db
        .select({ memberId: member.memberId })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(member)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(eq(member.personId, personId as any))
        .limit(1);
      memberId = m?.memberId ?? null;
    }
    if (memberId != null) {
      const [pending] = await db
        .select({ requestId: joinRequest.requestId })
        .from(joinRequest)
        .where(
          and(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(joinRequest.memberId, memberId as any),
            eq(joinRequest.status, "PENDING")
          )
        )
        .limit(1);
      if (!pending) {
        await db.insert(joinRequest).values({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          memberId: memberId as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chapterId: d.chapterId as any,
          priority: 1,
        });
      }
    }
  }

  revalidatePath("/me");
  redirect("/me");
}

/** /me/profile self-service save: person basics + current HOME address. */
export async function updateMyProfile(formData: FormData) {
  const session = await requireRole("MEMBER");
  const email = session.user?.email;
  if (!email) redirect("/login");

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    mobile: (formData.get("mobile") as string | null) ?? "",
    dateOfBirth: (formData.get("dateOfBirth") as string | null) ?? "",
    gender: formData.get("gender") || undefined,
    countryCode: (formData.get("countryCode") as string | null) ?? "",
    province: (formData.get("province") as string | null) ?? "",
    city: (formData.get("city") as string | null) ?? "",
  };
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/me/profile?err=1");
    return;
  }
  const d = parsed.data;

  const [u] = await db
    .select({ userId: users.userId, personId: users.personId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u?.personId) redirect("/welcome");
  const personId = u.personId;

  await savePersonBasics(personId, d);

  // Address upsert: history-preserving — close old row, insert new if values changed.
  const today = manilaToday();
  const [current] = await db
    .select({
      paAddressId: personAddress.addressId,
      city: address.city,
      province: address.province,
      countryCode: address.countryCode,
    })
    .from(personAddress)
    .innerJoin(address, eq(personAddress.addressId, address.addressId))
    .where(
      and(
        eq(personAddress.personId, personId),
        eq(personAddress.type, "HOME"),
        isNull(personAddress.validTo)
      )
    )
    .limit(1);

  const newCity = d.city || null;
  const newProvince = d.province || null;
  const unchanged =
    current &&
    current.city === newCity &&
    current.province === newProvince &&
    current.countryCode === d.countryCode;

  if (!unchanged) {
    if (current) {
      // Close the old row instead of mutating the (reusable) address record.
      await db
        .update(personAddress)
        .set({ validTo: today })
        .where(
          and(
            eq(personAddress.personId, personId),
            eq(personAddress.addressId, current.paAddressId),
            isNull(personAddress.validTo)
          )
        );
    }
    const [created] = await db
      .insert(address)
      .values({ city: newCity, province: newProvince, countryCode: d.countryCode })
      .returning({ addressId: address.addressId });
    await db.insert(personAddress).values({
      personId,
      addressId: created.addressId,
      type: "HOME",
      validFrom: today,
    });
  }

  revalidatePath("/me/profile");
  revalidatePath("/me");
  redirect("/me/profile?saved=1");
}
