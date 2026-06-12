// app/src/actions/ministry-leaders.ts
"use server";

import { db } from "@/lib/db";
import { person, branch } from "@/schema/core";
import { member } from "@/schema/membership";
import {
  network,
  ministry,
  ministryChapter,
  ministryMembership,
  networkLeader,
} from "@/schema/ministries";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { isHeadEligible } from "@/lib/journey";
import {
  buildLeaderSearchWhere,
  type AppointmentType,
} from "@/lib/ministry-leader-eligibility";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ilike, or, inArray } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EligibleMember = {
  memberId: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  currentStage: string;
  branchName: string;
};

export type NetworkLeaderInfo = {
  leaderId: number;
  memberId: number;
  firstName: string;
  lastName: string;
  memberCode: string;
};

export type MinistryHeadInfo = {
  membershipId: number;
  memberId: number;
  firstName: string;
  lastName: string;
  memberCode: string;
};

export type InnerCoreMember = {
  membershipId: number;
  memberId: number;
  firstName: string;
  lastName: string;
  memberCode: string;
};

export type ChapterLeaders = {
  chapterId: number;
  ministryId: number;
  ministryName: string;
  branchName: string;
  head: MinistryHeadInfo | null;
  innerCore: InnerCoreMember[];
};

export type NetworkLeadersData = {
  networkId: number;
  networkName: string;
  networkHead: NetworkLeaderInfo | null;
  chapters: ChapterLeaders[];
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getLeadersSidebarData(): Promise<NetworkLeadersData[]> {
  const networks = await db
    .select({ networkId: network.networkId, networkName: network.name })
    .from(network)
    .orderBy(network.name);

  const activeHeads = await db
    .select({
      networkId: networkLeader.networkId,
      leaderId: networkLeader.leaderId,
      memberId: networkLeader.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      memberCode: member.memberCode,
    })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(isNull(networkLeader.endedAt));

  const headMap = new Map(activeHeads.map((h) => [h.networkId, h]));

  const chapters = await db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryId: ministry.ministryId,
      ministryName: ministry.name,
      networkId: network.networkId,
      branchName: branch.name,
    })
    .from(ministryChapter)
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(network, eq(ministry.networkId, network.networkId))
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    .where(eq(ministryChapter.status, "ACTIVE"))
    .orderBy(ministry.name);

  if (chapters.length === 0) {
    return networks.map((n) => ({
      networkId: n.networkId,
      networkName: n.networkName,
      networkHead: headMap.get(n.networkId) ?? null,
      chapters: [],
    }));
  }

  const chapterIds = chapters.map((c) => c.chapterId);

  const ministryHeads = await db
    .select({
      chapterId: ministryMembership.chapterId,
      membershipId: ministryMembership.membershipId,
      memberId: ministryMembership.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      memberCode: member.memberCode,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        inArray(ministryMembership.chapterId, chapterIds),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    );

  const headsByChapter = new Map(ministryHeads.map((h) => [h.chapterId, h]));

  const innerCoreRows = await db
    .select({
      chapterId: ministryMembership.chapterId,
      membershipId: ministryMembership.membershipId,
      memberId: ministryMembership.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      memberCode: member.memberCode,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        inArray(ministryMembership.chapterId, chapterIds),
        eq(ministryMembership.isInnerCore, true),
        isNull(ministryMembership.endedAt)
      )
    )
    .orderBy(person.lastName, person.firstName);

  const innerCoreByChapter = new Map<number, InnerCoreMember[]>();
  for (const row of innerCoreRows) {
    if (!innerCoreByChapter.has(row.chapterId)) {
      innerCoreByChapter.set(row.chapterId, []);
    }
    innerCoreByChapter.get(row.chapterId)!.push(row);
  }

  const chaptersByNetwork = new Map<number, ChapterLeaders[]>();
  for (const ch of chapters) {
    if (!chaptersByNetwork.has(ch.networkId)) {
      chaptersByNetwork.set(ch.networkId, []);
    }
    chaptersByNetwork.get(ch.networkId)!.push({
      chapterId: ch.chapterId,
      ministryId: ch.ministryId,
      ministryName: ch.ministryName,
      branchName: ch.branchName,
      head: headsByChapter.get(ch.chapterId) ?? null,
      innerCore: innerCoreByChapter.get(ch.chapterId) ?? [],
    });
  }

  return networks.map((n) => ({
    networkId: n.networkId,
    networkName: n.networkName,
    networkHead: headMap.get(n.networkId) ?? null,
    chapters: chaptersByNetwork.get(n.networkId) ?? [],
  }));
}

export async function searchEligibleMembers(
  query: string,
  type: AppointmentType,
  chapterId?: number
): Promise<EligibleMember[]> {
  if (!query || query.trim().length < 2) return [];
  const q = `%${query.trim()}%`;
  const { requiresHeadEligible, requiresChapterMember } =
    buildLeaderSearchWhere(type);

  let rows;

  if (requiresChapterMember && chapterId) {
    rows = await db
      .select({
        memberId: member.memberId,
        memberCode: member.memberCode,
        firstName: person.firstName,
        lastName: person.lastName,
        currentStage: member.currentStage,
        branchName: branch.name,
      })
      .from(ministryMembership)
      .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
      .innerJoin(person, eq(member.personId, person.personId))
      .innerJoin(
        ministryChapter,
        eq(ministryMembership.chapterId, ministryChapter.chapterId)
      )
      .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
      .where(
        and(
          eq(ministryMembership.chapterId, chapterId as unknown as number),
          isNull(ministryMembership.endedAt),
          isNull(member.deletedAt),
          or(ilike(person.firstName, q), ilike(person.lastName, q))
        )
      )
      .limit(10);
  } else {
    rows = await db
      .select({
        memberId: member.memberId,
        memberCode: member.memberCode,
        firstName: person.firstName,
        lastName: person.lastName,
        currentStage: member.currentStage,
        branchName: branch.name,
      })
      .from(member)
      .innerJoin(person, eq(member.personId, person.personId))
      .innerJoin(branch, eq(member.branchId, branch.branchId))
      .where(
        and(
          isNull(member.deletedAt),
          eq(member.status, "ACTIVE" as unknown as "ACTIVE"),
          or(ilike(person.firstName, q), ilike(person.lastName, q))
        )
      )
      .limit(10);
  }

  return requiresHeadEligible
    ? rows.filter((r) => isHeadEligible(r.currentStage))
    : rows;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function appointNetworkHead(
  networkId: number,
  memberId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const [mem] = await db
    .select({ currentStage: member.currentStage, personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId as unknown as number))
    .limit(1);

  if (!mem) return { error: "Member not found" };
  if (!isHeadEligible(mem.currentStage))
    return { error: "Member must be Inner Core or Joshua Generation" };

  try {
    await db
      .update(networkLeader)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(networkLeader.networkId, networkId as unknown as number),
          isNull(networkLeader.endedAt)
        )
      );

    await db.insert(networkLeader).values({
      networkId: networkId as unknown as number,
      memberId: memberId as unknown as number,
    });

    const [account] = await db
      .select({ userId: users.userId, role: users.role })
      .from(users)
      .where(eq(users.personId, mem.personId))
      .limit(1);
    if (account && account.role === "MEMBER") {
      await db
        .update(users)
        .set({ role: "NETWORK_HEAD" })
        .where(eq(users.userId, account.userId));
    }

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to appoint" };
  }
}

export async function removeNetworkHead(
  networkId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const [current] = await db
    .select({
      leaderId: networkLeader.leaderId,
      memberId: networkLeader.memberId,
    })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .where(
      and(
        eq(networkLeader.networkId, networkId as unknown as number),
        isNull(networkLeader.endedAt)
      )
    )
    .limit(1);

  if (!current) return { error: "No active head found" };

  try {
    await db
      .update(networkLeader)
      .set({ endedAt: new Date() })
      .where(eq(networkLeader.leaderId, current.leaderId as unknown as number));

    const [mem] = await db
      .select({ personId: member.personId })
      .from(member)
      .where(eq(member.memberId, current.memberId as unknown as number))
      .limit(1);
    if (mem) {
      const stillLeads = await db
        .select({ leaderId: networkLeader.leaderId })
        .from(networkLeader)
        .where(
          and(
            eq(networkLeader.memberId, current.memberId as unknown as number),
            isNull(networkLeader.endedAt)
          )
        )
        .limit(1);
      if (stillLeads.length === 0) {
        const [account] = await db
          .select({ userId: users.userId })
          .from(users)
          .where(
            and(eq(users.personId, mem.personId), eq(users.role, "NETWORK_HEAD"))
          )
          .limit(1);
        if (account) {
          await db
            .update(users)
            .set({ role: "MEMBER" })
            .where(eq(users.userId, account.userId));
        }
      }
    }

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove" };
  }
}

export async function appointMinistryHead(
  chapterId: number,
  memberId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const [membership] = await db
    .select({
      membershipId: ministryMembership.membershipId,
      currentStage: member.currentStage,
      personId: member.personId,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .where(
      and(
        eq(ministryMembership.chapterId, chapterId as unknown as number),
        eq(ministryMembership.memberId, memberId as unknown as number),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);

  if (!membership) return { error: "Member is not an active chapter member" };
  if (!isHeadEligible(membership.currentStage))
    return { error: "Member must be Inner Core or Joshua Generation" };

  try {
    await db
      .update(ministryMembership)
      .set({ isLeader: false, leaderRole: null })
      .where(
        and(
          eq(ministryMembership.chapterId, chapterId as unknown as number),
          eq(ministryMembership.isLeader, true),
          eq(ministryMembership.leaderRole, "HEAD"),
          isNull(ministryMembership.endedAt)
        )
      );

    await db
      .update(ministryMembership)
      .set({ isLeader: true, leaderRole: "HEAD" })
      .where(
        eq(
          ministryMembership.membershipId,
          membership.membershipId as unknown as number
        )
      );

    const [account] = await db
      .select({ userId: users.userId, role: users.role })
      .from(users)
      .where(eq(users.personId, membership.personId))
      .limit(1);
    if (account && account.role === "MEMBER") {
      await db
        .update(users)
        .set({ role: "MINISTRY_HEAD" })
        .where(eq(users.userId, account.userId));
    }

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to appoint" };
  }
}

export async function removeMinistryHead(
  chapterId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const [current] = await db
    .select({
      membershipId: ministryMembership.membershipId,
      memberId: ministryMembership.memberId,
      personId: member.personId,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .where(
      and(
        eq(ministryMembership.chapterId, chapterId as unknown as number),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);

  if (!current) return { error: "No active ministry head found" };

  try {
    await db
      .update(ministryMembership)
      .set({ isLeader: false, leaderRole: null })
      .where(
        eq(
          ministryMembership.membershipId,
          current.membershipId as unknown as number
        )
      );

    const stillLeads = await db
      .select({ membershipId: ministryMembership.membershipId })
      .from(ministryMembership)
      .where(
        and(
          eq(ministryMembership.memberId, current.memberId as unknown as number),
          eq(ministryMembership.isLeader, true),
          eq(ministryMembership.leaderRole, "HEAD"),
          isNull(ministryMembership.endedAt)
        )
      )
      .limit(1);

    if (stillLeads.length === 0) {
      const [account] = await db
        .select({ userId: users.userId })
        .from(users)
        .where(
          and(
            eq(users.personId, current.personId),
            eq(users.role, "MINISTRY_HEAD")
          )
        )
        .limit(1);
      if (account) {
        await db
          .update(users)
          .set({ role: "MEMBER" })
          .where(eq(users.userId, account.userId));
      }
    }

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove" };
  }
}

export async function appointInnerCore(
  chapterId: number,
  memberId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const [membership] = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.chapterId, chapterId as unknown as number),
        eq(ministryMembership.memberId, memberId as unknown as number),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);

  if (!membership) return { error: "Member is not an active chapter member" };

  try {
    await db
      .update(ministryMembership)
      .set({ isInnerCore: true })
      .where(
        eq(
          ministryMembership.membershipId,
          membership.membershipId as unknown as number
        )
      );

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to appoint" };
  }
}

export async function removeInnerCore(
  membershipId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  try {
    await db
      .update(ministryMembership)
      .set({ isInnerCore: false })
      .where(
        eq(
          ministryMembership.membershipId,
          membershipId as unknown as number
        )
      );

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove" };
  }
}

export async function addMinistry(
  networkId: number,
  name: string
): Promise<{ success: true; ministryId: number } | { error: string }> {
  await requireRole("ADMIN");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Ministry name required" };

  try {
    const code = trimmed.toUpperCase().replace(/\s+/g, "_").slice(0, 20);

    const [newMinistry] = await db
      .insert(ministry)
      .values({
        networkId: networkId as unknown as number,
        code: `${code}_${Date.now().toString(36).toUpperCase()}`,
        name: trimmed,
      })
      .returning({ ministryId: ministry.ministryId });

    const [defaultBranch] = await db
      .select({ branchId: branch.branchId })
      .from(branch)
      .where(eq(branch.status, "ACTIVE"))
      .orderBy(branch.branchId)
      .limit(1);

    if (defaultBranch) {
      await db.insert(ministryChapter).values({
        ministryId: newMinistry.ministryId as unknown as number,
        branchId: defaultBranch.branchId as unknown as number,
        status: "ACTIVE",
      });
    }

    revalidatePath("/ministries");
    return { success: true, ministryId: newMinistry.ministryId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add ministry" };
  }
}

export async function closeMinistry(
  ministryId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  try {
    await db
      .update(ministryChapter)
      .set({ status: "CLOSED" })
      .where(
        eq(ministryChapter.ministryId, ministryId as unknown as number)
      );

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close ministry" };
  }
}
