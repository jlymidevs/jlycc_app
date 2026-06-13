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
import {
  buildLeaderSearchWhere,
  type AppointmentType,
} from "@/lib/ministry-leader-eligibility";
import { roleForLeadershipState } from "@/lib/ministry-dashboard-sync";
import type { Role } from "@/lib/authz";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ilike, or, inArray } from "drizzle-orm";

export { buildLeaderSearchWhere, type AppointmentType };

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

async function syncDashboardRole(memberId: number, personId?: number) {
  let linkedPersonId = personId;
  if (linkedPersonId == null) {
    const [mem] = await db
      .select({ personId: member.personId })
      .from(member)
      .where(eq(member.memberId, memberId as unknown as number))
      .limit(1);
    linkedPersonId = mem?.personId;
  }

  if (linkedPersonId == null) return;

  const [account] = await db
    .select({ userId: users.userId, role: users.role })
    .from(users)
    .where(eq(users.personId, linkedPersonId))
    .limit(1);

  if (!account) return;

  const activeMinistryHead = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId as unknown as number),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);

  const activeNetworkHead = await db
    .select({ leaderId: networkLeader.leaderId })
    .from(networkLeader)
    .where(
      and(
        eq(networkLeader.memberId, memberId as unknown as number),
        isNull(networkLeader.endedAt)
      )
    )
    .limit(1);

  const nextRole = roleForLeadershipState(account.role as Role, {
    isActiveMinistryHead: activeMinistryHead.length > 0,
    isActiveNetworkHead: activeNetworkHead.length > 0,
  });

  if (nextRole !== account.role) {
    await db.update(users).set({ role: nextRole }).where(eq(users.userId, account.userId));
  }
}

function revalidateMinistryDashboards() {
  revalidatePath("/ministries");
  revalidatePath("/me");
  revalidatePath("/me/ministries");
  revalidatePath("/ministry");
  revalidatePath("/network-head");
}

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
  // type/chapterId kept for call-site compatibility; open appointment ignores
  // them and lists any member with a record.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type: AppointmentType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chapterId?: number
): Promise<EligibleMember[]> {
  const q = query.trim();
  const conds = [isNull(member.deletedAt)];
  if (q.length >= 2) {
    const like = `%${q}%`;
    const nameMatch = or(
      ilike(person.firstName, like),
      ilike(person.lastName, like),
      ilike(member.memberCode, like)
    );
    if (nameMatch) conds.push(nameMatch);
  }

  return db
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
    .where(and(...conds))
    .orderBy(person.lastName, person.firstName)
    .limit(q.length >= 2 ? 25 : 100);
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

  try {
    const currentHeads = await db
      .select({
        memberId: networkLeader.memberId,
        personId: member.personId,
      })
      .from(networkLeader)
      .innerJoin(member, eq(networkLeader.memberId, member.memberId))
      .where(
        and(
          eq(networkLeader.networkId, networkId as unknown as number),
          isNull(networkLeader.endedAt)
        )
      );

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

    for (const head of currentHeads) {
      await syncDashboardRole(head.memberId, head.personId);
    }
    await syncDashboardRole(memberId, mem.personId);

    revalidateMinistryDashboards();
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

    await syncDashboardRole(current.memberId);

    revalidateMinistryDashboards();
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

  // Open appointment: any member can be made head. Verify the member exists;
  // if they aren't yet a chapter member, enroll them as part of appointing.
  const [mem] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId as unknown as number))
    .limit(1);

  if (!mem) return { error: "Member not found" };

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

  try {
    const currentHeads = await db
      .select({
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
      );

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

    if (membership) {
      await db
        .update(ministryMembership)
        .set({ isLeader: true, leaderRole: "HEAD" })
        .where(
          eq(
            ministryMembership.membershipId,
            membership.membershipId as unknown as number
          )
        );
    } else {
      await db.insert(ministryMembership).values({
        chapterId: chapterId as unknown as number,
        memberId: memberId as unknown as number,
        joinedAt: new Date(),
        isLeader: true,
        leaderRole: "HEAD",
      });
    }

    for (const head of currentHeads) {
      await syncDashboardRole(head.memberId, head.personId);
    }
    await syncDashboardRole(memberId, mem.personId);

    revalidateMinistryDashboards();
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

    await syncDashboardRole(current.memberId, current.personId);

    revalidateMinistryDashboards();
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

  // Open appointment: enroll the member into the chapter if needed, then flag
  // them as inner core.
  const [mem] = await db
    .select({ memberId: member.memberId })
    .from(member)
    .where(eq(member.memberId, memberId as unknown as number))
    .limit(1);

  if (!mem) return { error: "Member not found" };

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

  try {
    if (membership) {
      await db
        .update(ministryMembership)
        .set({ isInnerCore: true })
        .where(
          eq(
            ministryMembership.membershipId,
            membership.membershipId as unknown as number
          )
        );
    } else {
      await db.insert(ministryMembership).values({
        chapterId: chapterId as unknown as number,
        memberId: memberId as unknown as number,
        joinedAt: new Date(),
        isInnerCore: true,
      });
    }

    revalidateMinistryDashboards();
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

    revalidateMinistryDashboards();
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

export async function addNetwork(
  name: string
): Promise<{ success: true; networkId: number } | { error: string }> {
  await requireRole("ADMIN");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Network name required" };

  try {
    const code = trimmed.toUpperCase().replace(/\s+/g, "_").slice(0, 20);

    const [newNetwork] = await db
      .insert(network)
      .values({
        code: `${code}_${Date.now().toString(36).toUpperCase()}`,
        name: trimmed,
      })
      .returning({ networkId: network.networkId });

    revalidatePath("/ministries");
    return { success: true, networkId: newNetwork.networkId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add network" };
  }
}

export async function renameMinistry(
  ministryId: number,
  name: string
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");
  const trimmed = name.trim();
  if (!trimmed) return { error: "Ministry name required" };

  try {
    await db
      .update(ministry)
      .set({ name: trimmed })
      .where(eq(ministry.ministryId, ministryId as unknown as number));
    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to rename ministry" };
  }
}

export async function renameNetwork(
  networkId: number,
  name: string
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");
  const trimmed = name.trim();
  if (!trimmed) return { error: "Network name required" };

  try {
    await db
      .update(network)
      .set({ name: trimmed })
      .where(eq(network.networkId, networkId as unknown as number));
    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to rename network" };
  }
}

export async function deleteMinistry(
  ministryId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  try {
    const chapters = await db
      .select({ chapterId: ministryChapter.chapterId })
      .from(ministryChapter)
      .where(eq(ministryChapter.ministryId, ministryId as unknown as number));
    const chapterIds = chapters.map((c) => c.chapterId);

    if (chapterIds.length > 0) {
      await db
        .delete(ministryMembership)
        .where(inArray(ministryMembership.chapterId, chapterIds));
    }
    await db
      .delete(ministryChapter)
      .where(eq(ministryChapter.ministryId, ministryId as unknown as number));
    await db
      .delete(ministry)
      .where(eq(ministry.ministryId, ministryId as unknown as number));

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete ministry" };
  }
}

export async function deleteNetwork(
  networkId: number
): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");

  const existing = await db
    .select({ ministryId: ministry.ministryId })
    .from(ministry)
    .where(eq(ministry.networkId, networkId as unknown as number))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Delete the ministries in this network first" };
  }

  try {
    await db
      .delete(networkLeader)
      .where(eq(networkLeader.networkId, networkId as unknown as number));
    await db
      .delete(network)
      .where(eq(network.networkId, networkId as unknown as number));

    revalidatePath("/ministries");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete network" };
  }
}
