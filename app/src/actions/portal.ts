"use server";

import { db } from "@/lib/db";
import { member, regularMemberApplication } from "@/schema/membership";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function submitApplicationFromPortal(
  memberId: number
): Promise<{ success: true } | { error: string }> {
  // Guard: member must exist and be ACTIVE
  const [memberRow] = await db
    .select({ status: member.status })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);

  if (!memberRow) return { error: "Member not found" };
  if (memberRow.status !== "ACTIVE") return { error: "Only active members can apply" };

  // Guard: no existing PENDING or APPROVED application
  const existing = await db
    .select({ applicationId: regularMemberApplication.applicationId })
    .from(regularMemberApplication)
    .where(
      and(
        eq(regularMemberApplication.memberId, memberId),
        inArray(regularMemberApplication.status, ["PENDING", "APPROVED"])
      )
    )
    .limit(1);

  if (existing.length > 0) return { error: "Application already exists" };

  await db.insert(regularMemberApplication).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memberId: memberId as any,
    status: "PENDING",
    criteriaChecklist: {},
  });

  revalidatePath(`/portal`);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members/applications");
  return { success: true };
}
