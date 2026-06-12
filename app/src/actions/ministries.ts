// app/src/actions/ministries.ts
"use server";

import { db } from "@/lib/db";
import { person, branch } from "@/schema/core";
import { member } from "@/schema/membership";
import {
  network,
  ministry,
  ministryChapter,
  ministryMembership,
} from "@/schema/ministries";
import {
  createChapterSchema,
  addMemberSchema,
  endMemberSchema,
  CreateChapterInput,
  AddMemberInput,
  EndMemberInput,
} from "@/lib/validations/ministries";
import { users } from "@/schema/app";
import { isHeadEligible } from "@/lib/journey";
import { requireRole } from "@/lib/authz-server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ilike, or, count, asc } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NetworkGroup = {
  networkId: number;
  networkName: string;
  ministries: {
    ministryId: number;
    name: string;
    code: string;
    targetDemographic: string | null;
  }[];
};

export type MinistryDetail = {
  ministryId: number;
  name: string;
  code: string;
  description: string | null;
  targetDemographic: string | null;
  foundedOn: string | null;
  networkName: string;
  chapters: {
    chapterId: number;
    branchName: string;
    status: "ACTIVE" | "PAUSED" | "CLOSED";
    launchedOn: string | null;
    activeMemberCount: number;
  }[];
};

export type ChapterDetail = {
  chapterId: number;
  ministryId: number;
  ministryName: string;
  branchName: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  launchedOn: string | null;
  activeMembers: {
    membershipId: number;
    memberId: number;
    memberCode: string;
    firstName: string;
    lastName: string;
    joinedAt: Date;
    isLeader: boolean;
    leaderRole: "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR" | null;
  }[];
};

export type MemberSearchResult = {
  memberId: number;
  memberCode: string;
  firstName: string;
  lastName: string;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getMinistries(): Promise<NetworkGroup[]> {
  const rows = await db
    .select({
      ministryId: ministry.ministryId,
      name: ministry.name,
      code: ministry.code,
      targetDemographic: ministry.targetDemographic,
      networkId: network.networkId,
      networkName: network.name,
    })
    .from(ministry)
    .innerJoin(network, eq(ministry.networkId, network.networkId))
    .orderBy(asc(network.name), asc(ministry.name));

  const grouped = new Map<
    number,
    { networkName: string; ministries: NetworkGroup["ministries"] }
  >();

  for (const row of rows) {
    const nid = row.networkId;
    if (!grouped.has(nid)) {
      grouped.set(nid, { networkName: row.networkName, ministries: [] });
    }
    grouped.get(nid)!.ministries.push({
      ministryId: row.ministryId,
      name: row.name,
      code: row.code,
      targetDemographic: row.targetDemographic,
    });
  }

  return Array.from(grouped.entries()).map(([networkId, g]) => ({
    networkId,
    networkName: g.networkName,
    ministries: g.ministries,
  }));
}

export async function getMinistry(
  id: number
): Promise<MinistryDetail | null> {
  const [min] = await db
    .select({
      ministryId: ministry.ministryId,
      name: ministry.name,
      code: ministry.code,
      description: ministry.description,
      targetDemographic: ministry.targetDemographic,
      foundedOn: ministry.foundedOn,
      networkName: network.name,
    })
    .from(ministry)
    .innerJoin(network, eq(ministry.networkId, network.networkId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(ministry.ministryId, id as any))
    .limit(1);

  if (!min) return null;

  const chapters = await db
    .select({
      chapterId: ministryChapter.chapterId,
      status: ministryChapter.status,
      launchedOn: ministryChapter.launchedOn,
      branchName: branch.name,
    })
    .from(ministryChapter)
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(ministryChapter.ministryId, id as any))
    .orderBy(ministryChapter.chapterId);

  const memberCounts = await db
    .select({
      chapterId: ministryMembership.chapterId,
      activeMemberCount: count(),
    })
    .from(ministryMembership)
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryChapter.ministryId, id as any),
        isNull(ministryMembership.endedAt)
      )
    )
    .groupBy(ministryMembership.chapterId);

  const countMap = new Map(
    memberCounts.map((r) => [r.chapterId, Number(r.activeMemberCount)])
  );

  return {
    ...min,
    chapters: chapters.map((c) => ({
      ...c,
      status: c.status as "ACTIVE" | "PAUSED" | "CLOSED",
      activeMemberCount: countMap.get(c.chapterId) ?? 0,
    })),
  };
}

export async function getChapter(id: number): Promise<ChapterDetail | null> {
  const [ch] = await db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryId: ministry.ministryId,
      ministryName: ministry.name,
      branchName: branch.name,
      status: ministryChapter.status,
      launchedOn: ministryChapter.launchedOn,
    })
    .from(ministryChapter)
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(ministryChapter.chapterId, id as any))
    .limit(1);

  if (!ch) return null;

  const activeMembers = await db
    .select({
      membershipId: ministryMembership.membershipId,
      memberId: ministryMembership.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
      joinedAt: ministryMembership.joinedAt,
      isLeader: ministryMembership.isLeader,
      leaderRole: ministryMembership.leaderRole,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryMembership.chapterId, id as any),
        isNull(ministryMembership.endedAt)
      )
    )
    .orderBy(ministryMembership.membershipId);

  return {
    ...ch,
    status: ch.status as "ACTIVE" | "PAUSED" | "CLOSED",
    activeMembers: activeMembers.map((m) => ({
      ...m,
      leaderRole: m.leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR" | null,
    })),
  };
}

export async function searchMembers(
  query: string
): Promise<MemberSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = `%${query.trim()}%`;

  const rows = await db
    .select({
      memberId: member.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        isNull(member.deletedAt),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(member.status, "ACTIVE" as any),
        or(
          ilike(person.firstName, q),
          ilike(person.lastName, q),
          ilike(member.memberCode, q)
        )
      )
    )
    .limit(10);

  return rows;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createChapter(
  data: CreateChapterInput
): Promise<{ success: true; chapterId: number } | { error: string }> {
  const parsed = createChapterSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ministryId, branchId, launchedOn, status } = parsed.data;

  const existing = await db
    .select({ chapterId: ministryChapter.chapterId })
    .from(ministryChapter)
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryChapter.ministryId, ministryId as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryChapter.branchId, branchId as any)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "chapter_already_exists" };
  }

  try {
    const [row] = await db
      .insert(ministryChapter)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ministryId: ministryId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchId: branchId as any,
        launchedOn: launchedOn ?? null,
        status,
      })
      .returning({ chapterId: ministryChapter.chapterId });

    revalidatePath(`/ministries/${ministryId}`);
    return { success: true, chapterId: row.chapterId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create chapter" };
  }
}

export async function updateChapterStatus(
  chapterId: number,
  status: "ACTIVE" | "PAUSED" | "CLOSED"
): Promise<{ success: true } | { error: string }> {
  try {
    await db
      .update(ministryChapter)
      .set({ status })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryChapter.chapterId, chapterId as any));

    const [ch] = await db
      .select({ ministryId: ministryChapter.ministryId })
      .from(ministryChapter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryChapter.chapterId, chapterId as any))
      .limit(1);

    if (ch) revalidatePath(`/ministries/${ch.ministryId}`);
    revalidatePath(`/ministries`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update status" };
  }
}

export async function addMember(
  data: AddMemberInput
): Promise<{ success: true } | { error: string }> {
  const parsed = addMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { chapterId, memberId, joinedAt, isLeader, leaderRole } = parsed.data;

  const existing = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryMembership.chapterId, chapterId as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(ministryMembership.memberId, memberId as any),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "member_already_active" };
  }

  try {
    await db.insert(ministryMembership).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapterId: chapterId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: memberId as any,
      joinedAt: new Date(joinedAt),
      isLeader,
      leaderRole: leaderRole ?? null,
    });

    revalidatePath(`/ministries`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add member" };
  }
}

export async function endMembership(
  data: EndMemberInput
): Promise<{ success: true } | { error: string }> {
  const parsed = endMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { membershipId, endedAt, endedReason } = parsed.data;

  const [existing] = await db
    .select({ endedAt: ministryMembership.endedAt })
    .from(ministryMembership)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(ministryMembership.membershipId, membershipId as any))
    .limit(1);

  if (!existing) return { error: "membership_not_found" };
  if (existing.endedAt !== null) return { error: "membership_already_ended" };

  try {
    await db
      .update(ministryMembership)
      .set({
        endedAt: new Date(endedAt),
        endedReason: endedReason ?? null,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryMembership.membershipId, membershipId as any));

    revalidatePath(`/ministries`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to end membership" };
  }
}

/** Shared by admin setLeaderRole (HEAD path) and network-head scoped appointment. */
export async function applyChapterHeadChange(
  membershipId: number,
  makeHead: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    // Load the membership + member stage + linked account.
    const [row] = await db
      .select({
        memberId: ministryMembership.memberId,
        currentStage: member.currentStage,
        personId: member.personId,
      })
      .from(ministryMembership)
      .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryMembership.membershipId, membershipId as any))
      .limit(1);
    if (!row) return { error: "Membership not found" };

    // Eligibility: only Inner Core / Joshua Generation can be HEAD.
    if (makeHead && !isHeadEligible(row.currentStage)) {
      return {
        error:
          "Only Inner Core or Joshua Generation members can be appointed ministry head",
      };
    }

    await db
      .update(ministryMembership)
      .set({
        isLeader: makeHead,
        leaderRole: makeHead ? "HEAD" : null,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryMembership.membershipId, membershipId as any));

    // Sync linked account role.
    const [account] = await db
      .select({ userId: users.userId, role: users.role })
      .from(users)
      .where(eq(users.personId, row.personId))
      .limit(1);
    if (account) {
      if (makeHead && account.role === "MEMBER") {
        await db
          .update(users)
          .set({ role: "MINISTRY_HEAD" })
          .where(eq(users.userId, account.userId));
      }
      if (!makeHead && account.role === "MINISTRY_HEAD") {
        // Demote only when they lead no other chapter.
        const stillLeads = await db
          .select({ membershipId: ministryMembership.membershipId })
          .from(ministryMembership)
          .where(
            and(
              eq(ministryMembership.memberId, row.memberId),
              eq(ministryMembership.isLeader, true),
              eq(ministryMembership.leaderRole, "HEAD"),
              isNull(ministryMembership.endedAt)
            )
          )
          .limit(1);
        if (stillLeads.length === 0) {
          await db
            .update(users)
            .set({ role: "MEMBER" })
            .where(eq(users.userId, account.userId));
        }
      }
    }

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update leader role" };
  }
}

export async function setLeaderRole(
  membershipId: number,
  isLeader: boolean,
  leaderRole?: string
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");
  if (isLeader && !leaderRole) {
    return { error: "Leader role required" };
  }

  try {
    if (isLeader && leaderRole === "HEAD") {
      const result = await applyChapterHeadChange(membershipId, true);
      if ("error" in result) return result;
    } else if (!isLeader || leaderRole !== "HEAD") {
      // Non-HEAD roles: update directly without role sync.
      const [row] = await db
        .select({ membershipId: ministryMembership.membershipId })
        .from(ministryMembership)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(eq(ministryMembership.membershipId, membershipId as any))
        .limit(1);
      if (!row) return { error: "Membership not found" };

      // If removing HEAD, use applyChapterHeadChange for role sync.
      const [cur] = await db
        .select({ isLeader: ministryMembership.isLeader, leaderRole: ministryMembership.leaderRole })
        .from(ministryMembership)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(eq(ministryMembership.membershipId, membershipId as any))
        .limit(1);
      if (cur?.isLeader && cur?.leaderRole === "HEAD" && (!isLeader || leaderRole !== "HEAD")) {
        const result = await applyChapterHeadChange(membershipId, false);
        if ("error" in result) return result;
        // Now re-set with the new non-HEAD role if applicable.
        if (isLeader && leaderRole) {
          await db
            .update(ministryMembership)
            .set({
              isLeader,
              leaderRole: leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR",
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .where(eq(ministryMembership.membershipId, membershipId as any));
        }
      } else {
        await db
          .update(ministryMembership)
          .set({
            isLeader,
            leaderRole: isLeader
              ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR")
              : null,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .where(eq(ministryMembership.membershipId, membershipId as any));
      }
    }

    revalidatePath(`/ministries`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update leader role" };
  }
}
