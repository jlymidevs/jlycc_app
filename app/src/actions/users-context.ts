// app/src/actions/users-context.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import {
  network,
  networkLeader,
  ministry,
  ministryChapter,
  ministryMembership,
} from "@/schema/ministries";
import { branch } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { and, asc, eq, isNull } from "drizzle-orm";

export type UserContext = {
  personId: number;
  stageName: string | null;
  stageCode: string | null;
  networkHeadships: { networkId: number; name: string }[];
  chapterHeadships: { ministryName: string; branchName: string }[];
  memberships: {
    membershipId: number;
    ministryName: string;
    branchName: string;
    priority: number | null;
    isLeader: boolean;
  }[];
};

export async function getUserContext(personId: number): Promise<UserContext | null> {
  await requireRole("ADMIN");

  const [mem] = await db
    .select({ memberId: member.memberId, currentStage: member.currentStage })
    .from(member)
    .where(eq(member.personId, personId))
    .limit(1);

  if (!mem) {
    return {
      personId,
      stageName: null,
      stageCode: null,
      networkHeadships: [],
      chapterHeadships: [],
      memberships: [],
    };
  }

  const [stageRow] = mem.currentStage
    ? await db
        .select({ name: lifecycleStage.name })
        .from(lifecycleStage)
        .where(eq(lifecycleStage.stageCode, mem.currentStage))
        .limit(1)
    : [undefined];

  const [networkHeadships, chapterHeadships, memberships] = await Promise.all([
    db
      .select({ networkId: network.networkId, name: network.name })
      .from(networkLeader)
      .innerJoin(network, eq(networkLeader.networkId, network.networkId))
      .where(and(eq(networkLeader.memberId, mem.memberId), isNull(networkLeader.endedAt)))
      .orderBy(asc(network.name)),

    db
      .select({
        ministryName: ministry.name,
        branchName: branch.name,
      })
      .from(ministryMembership)
      .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
      .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
      .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
      .where(
        and(
          eq(ministryMembership.memberId, mem.memberId),
          eq(ministryMembership.isLeader, true),
          eq(ministryMembership.leaderRole, "HEAD"),
          isNull(ministryMembership.endedAt)
        )
      )
      .orderBy(asc(ministry.name)),

    db
      .select({
        membershipId: ministryMembership.membershipId,
        ministryName: ministry.name,
        branchName: branch.name,
        priority: ministryMembership.priority,
        isLeader: ministryMembership.isLeader,
      })
      .from(ministryMembership)
      .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
      .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
      .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
      .where(
        and(eq(ministryMembership.memberId, mem.memberId), isNull(ministryMembership.endedAt))
      )
      .orderBy(asc(ministry.name)),
  ]);

  return {
    personId,
    stageName: stageRow?.name ?? mem.currentStage,
    stageCode: mem.currentStage,
    networkHeadships,
    chapterHeadships: chapterHeadships as { ministryName: string; branchName: string }[],
    memberships: memberships as { membershipId: number; ministryName: string; branchName: string; priority: number | null; isLeader: boolean }[],
  };
}

export async function getUserBasic(personId: number) {
  await requireRole("ADMIN");
  const [u] = await db
    .select({ name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.personId, personId))
    .limit(1);
  return u ?? null;
}
