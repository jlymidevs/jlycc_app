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
} from "@/lib/validations/account";
import { provisionMemberProfile } from "@/lib/provision";
import { requireRole } from "@/lib/authz-server";
import { and, eq, isNull } from "drizzle-orm";
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

  await db
    .update(person)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      dateOfBirth: d.dateOfBirth ? d.dateOfBirth : null,
      gender: d.gender ?? null,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(person.personId, personId as any));

  if (d.mobile) {
    const [existingMobile] = await db
      .select({ contactId: contactInfo.contactId })
      .from(contactInfo)
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(contactInfo.personId, personId as any),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personId: personId as any,
        type: "MOBILE",
        value: d.mobile,
        isPrimary: false,
      });
    }
  }

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
