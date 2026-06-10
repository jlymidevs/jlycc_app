// app/src/lib/provision.ts
// Ensures a login account is linked to a person + member profile.
// Used by self-signup and Google auto-creation. Every user gets a
// member profile (spec: universal profiles), stage REGULAR_MEMBER.
import { db } from "@/lib/db";
import { person, contactInfo, branch } from "@/schema/core";
import { member } from "@/schema/membership";
import { users } from "@/schema/app";
import { asc, eq, and, isNull } from "drizzle-orm";

export interface ProvisionResult {
  personId: number;
  memberId: number;
}

/**
 * Find-or-create the person + member profile for an email, and link it
 * to the given user row. Idempotent.
 */
export async function provisionMemberProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<ProvisionResult> {
  // 1. Person: match by EMAIL contact_info, else create.
  let personId: number;
  const [existingContact] = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .innerJoin(person, eq(contactInfo.personId, person.personId))
    .where(
      and(
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.value, email),
        isNull(person.deletedAt)
      )
    )
    .limit(1);

  if (existingContact) {
    personId = existingContact.personId;
  } else {
    const [newPerson] = await db
      .insert(person)
      .values({ firstName, lastName })
      .returning({ personId: person.personId });
    personId = newPerson.personId;
    await db.insert(contactInfo).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: personId as any,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });
  }

  // 2. Member: find by person, else create at REGULAR_MEMBER on the main branch.
  let memberId: number;
  const [existingMember] = await db
    .select({ memberId: member.memberId })
    .from(member)
    .where(eq(member.personId, personId))
    .limit(1);

  if (existingMember) {
    memberId = existingMember.memberId;
  } else {
    const [mainBranch] = await db
      .select({ branchId: branch.branchId })
      .from(branch)
      .orderBy(asc(branch.branchId))
      .limit(1);
    if (!mainBranch) throw new Error("No branch exists — seed branches first");
    const [newMember] = await db
      .insert(member)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personId: personId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchId: mainBranch.branchId as any,
        memberCode: `M-${personId}`,
        currentStage: "REGULAR_MEMBER",
        joinedAt: new Date(),
      })
      .returning({ memberId: member.memberId });
    memberId = newMember.memberId;
  }

  // 3. Link user → person.
  await db
    .update(users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ personId: personId as any })
    .where(eq(users.userId, userId));

  return { personId, memberId };
}
