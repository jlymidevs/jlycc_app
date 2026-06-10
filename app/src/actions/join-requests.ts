// app/src/actions/join-requests.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import {
  joinRequest,
  ministryMembership,
} from "@/schema/ministries";
import { joinRequestSchema } from "@/lib/validations/account";
import { requireRole } from "@/lib/authz-server";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Resolve the signed-in user's memberId (null when not provisioned). */
async function currentMemberId(): Promise<number | null> {
  const session = await requireRole("MEMBER");
  const email = session.user?.email;
  if (!email) return null;
  const [row] = await db
    .select({ memberId: member.memberId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);
  return row?.memberId ?? null;
}

/** Priority ranks already taken by active memberships + pending requests. */
async function takenPriorities(memberId: number): Promise<number[]> {
  const memberships = await db
    .select({ priority: ministryMembership.priority })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        isNull(ministryMembership.endedAt)
      )
    );
  const pending = await db
    .select({ priority: joinRequest.priority })
    .from(joinRequest)
    .where(
      and(eq(joinRequest.memberId, memberId), eq(joinRequest.status, "PENDING"))
    );
  return [...memberships, ...pending]
    .map((r) => r.priority)
    .filter((p): p is number => p != null);
}

export async function requestJoin(formData: FormData) {
  const memberId = await currentMemberId();
  if (!memberId) return { errors: { chapterId: ["Profile not linked"] } };

  const parsed = joinRequestSchema.safeParse({
    chapterId: Number(formData.get("chapterId")),
    priority: Number(formData.get("priority")),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { chapterId, priority } = parsed.data;

  const taken = await takenPriorities(memberId);
  if (taken.includes(priority)) {
    return {
      errors: { priority: [`Priority ${priority} is already taken`] },
    };
  }

  // Already an active member of this chapter?
  const [already] = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        eq(ministryMembership.chapterId, chapterId),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  if (already) {
    return { errors: { chapterId: ["You already belong to this ministry"] } };
  }

  await db.insert(joinRequest).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memberId: memberId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chapterId: chapterId as any,
    priority,
  });

  revalidatePath("/me");
  revalidatePath("/ministry");
  return { ok: true };
}

/** ChapterIds the signed-in head leads (active HEAD memberships). */
export async function headChapterIds(): Promise<number[]> {
  const session = await requireRole("MINISTRY_HEAD");
  const email = session.user?.email;
  if (!email) return [];
  const rows = await db
    .select({ chapterId: ministryMembership.chapterId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(
      ministryMembership,
      eq(ministryMembership.memberId, member.memberId)
    )
    .where(
      and(
        eq(users.email, email),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    );
  return rows.map((r) => r.chapterId);
}

async function loadOwnedPendingRequest(requestId: number) {
  const chapters = await headChapterIds();
  if (chapters.length === 0) return null;
  const [req] = await db
    .select()
    .from(joinRequest)
    .where(
      and(
        eq(joinRequest.requestId, requestId),
        eq(joinRequest.status, "PENDING"),
        inArray(joinRequest.chapterId, chapters)
      )
    )
    .limit(1);
  return req ?? null;
}

export async function approveJoinRequest(requestId: number) {
  const req = await loadOwnedPendingRequest(requestId);
  if (!req) return { errors: { request: ["Request not found"] } };

  // Idempotent: skip duplicate membership.
  const [already] = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, req.memberId),
        eq(ministryMembership.chapterId, req.chapterId),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  if (!already) {
    await db.insert(ministryMembership).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapterId: req.chapterId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: req.memberId as any,
      joinedAt: new Date(),
      priority: req.priority,
    });
  }

  await db
    .update(joinRequest)
    .set({ status: "APPROVED", decidedAt: new Date() })
    .where(eq(joinRequest.requestId, requestId));

  revalidatePath("/ministry");
  revalidatePath("/me");
  return { ok: true };
}

export async function rejectJoinRequest(requestId: number) {
  const req = await loadOwnedPendingRequest(requestId);
  if (!req) return { errors: { request: ["Request not found"] } };

  await db
    .update(joinRequest)
    .set({ status: "REJECTED", decidedAt: new Date() })
    .where(eq(joinRequest.requestId, requestId));

  revalidatePath("/ministry");
  revalidatePath("/me");
  return { ok: true };
}
