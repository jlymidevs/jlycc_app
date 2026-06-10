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
import { person } from "@/schema/core";
import { signupSchema } from "@/lib/validations/account";
import { provisionMemberProfile } from "@/lib/provision";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

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
