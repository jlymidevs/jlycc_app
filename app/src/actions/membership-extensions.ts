// app/src/actions/membership-extensions.ts
"use server";

import { db } from "@/lib/db";
import {
  memberRole,
  pastoralCareAssignment,
  regularMemberApplication,
} from "@/schema/membership";
import {
  AssignRoleInput,
  AssignPcmInput,
} from "@/lib/validations/membership-extensions";
import { revalidatePath } from "next/cache";
import { eq, and, isNull } from "drizzle-orm";

export async function submitApplication(
  memberId: number
): Promise<{ success: true } | { error: string }> {
  // Guard: check for existing PENDING application
  const existing = await db
    .select()
    .from(regularMemberApplication)
    .where(
      and(
        eq(regularMemberApplication.memberId, memberId),
        eq(regularMemberApplication.status, "PENDING")
      )
    );
  if (existing.length > 0) {
    return { error: "Member already has a pending application" };
  }

  try {
    await db.insert(regularMemberApplication).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: memberId as any,
      status: "PENDING",
      criteriaChecklist: {},
    });

    revalidatePath(`/members/${memberId}`);
    revalidatePath("/members/applications");
    return { success: true };
  } catch {
    return { error: "Failed to submit application" };
  }
}

export async function reviewApplication(
  applicationId: number,
  status: "APPROVED" | "REJECTED" | "WITHDRAWN",
  decisionNotes?: string
): Promise<{ success: true } | { error: string }> {
  // Guard: find application
  const apps = await db
    .select()
    .from(regularMemberApplication)
    .where(eq(regularMemberApplication.applicationId, applicationId));
  if (apps.length === 0) {
    return { error: "Application not found" };
  }
  const app = apps[0];
  if (app.status !== "PENDING") {
    return { error: "Application is not pending" };
  }

  try {
    await db
      .update(regularMemberApplication)
      .set({
        status,
        reviewedAt: new Date(),
        decisionNotes: decisionNotes ?? null,
      })
      .where(eq(regularMemberApplication.applicationId, applicationId));

    revalidatePath("/members/applications");
    revalidatePath(`/members/${app.memberId}`);
    return { success: true };
  } catch {
    return { error: "Failed to review application" };
  }
}

export async function assignRole(
  data: AssignRoleInput
): Promise<{ success: true } | { error: string }> {
  try {
    await db.insert(memberRole).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: data.memberId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roleId: data.roleId as any,
      assignedAt: new Date(data.assignedAt),
      notes: data.notes,
    });

    revalidatePath(`/members/${data.memberId}`);
    return { success: true };
  } catch {
    return { error: "Failed to assign role" };
  }
}

export async function endRole(
  memberRoleId: number,
  endedAt: string
): Promise<{ success: true } | { error: string }> {
  // Guard: find role
  const roles = await db
    .select()
    .from(memberRole)
    .where(eq(memberRole.memberRoleId, memberRoleId));
  if (roles.length === 0) {
    return { error: "Role not found" };
  }
  const role = roles[0];
  if (role.endedAt !== null) {
    return { error: "Role already ended" };
  }

  try {
    await db
      .update(memberRole)
      .set({ endedAt: new Date(endedAt) })
      .where(eq(memberRole.memberRoleId, memberRoleId));

    revalidatePath(`/members/${role.memberId}`);
    return { success: true };
  } catch {
    return { error: "Failed to end role" };
  }
}

export async function assignPcm(
  data: AssignPcmInput
): Promise<{ success: true } | { error: string }> {
  // Guard: self-assignment
  if (data.carerMemberId === data.assignedMemberId) {
    return { error: "Cannot assign self as PCM" };
  }

  // Guard: existing active PCM
  const existing = await db
    .select()
    .from(pastoralCareAssignment)
    .where(
      and(
        eq(pastoralCareAssignment.assignedMemberId, data.assignedMemberId),
        isNull(pastoralCareAssignment.endedAt)
      )
    );
  if (existing.length > 0) {
    return { error: "Member already has an active PCM assignment" };
  }

  try {
    await db.insert(pastoralCareAssignment).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      carerMemberId: data.carerMemberId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignedMemberId: data.assignedMemberId as any,
      assignedAt: new Date(data.assignedAt),
      status: "ACTIVE",
      notes: data.notes,
    });

    revalidatePath(`/members/${data.assignedMemberId}`);
    return { success: true };
  } catch {
    return { error: "Failed to assign PCM" };
  }
}

export async function endPcm(
  assignmentId: number,
  endedAt: string
): Promise<{ success: true } | { error: string }> {
  // Guard: find assignment
  const assignments = await db
    .select()
    .from(pastoralCareAssignment)
    .where(eq(pastoralCareAssignment.assignmentId, assignmentId));
  if (assignments.length === 0) {
    return { error: "Assignment not found" };
  }
  const assignment = assignments[0];
  if (assignment.endedAt !== null) {
    return { error: "Assignment already ended" };
  }

  try {
    await db
      .update(pastoralCareAssignment)
      .set({ endedAt: new Date(endedAt), status: "ENDED" })
      .where(eq(pastoralCareAssignment.assignmentId, assignmentId));

    revalidatePath(`/members/${assignment.assignedMemberId}`);
    return { success: true };
  } catch {
    return { error: "Failed to end PCM assignment" };
  }
}
