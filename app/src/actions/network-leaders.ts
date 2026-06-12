// app/src/actions/network-leaders.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { network, networkLeader, ministry, ministryChapter, ministryMembership } from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { applyChapterHeadChange } from "@/actions/ministries";
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Resolve the acting user's member_id (for appointed_by). Nullable. */
async function actorMemberId(email: string): Promise<number | null> {
  const [row] = await db
    .select({ memberId: member.memberId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);
  return row?.memberId ?? null;
}

/** Role fallback when a headship ends: MINISTRY_HEAD if still heads a chapter, else MEMBER. Never touches ADMIN+. */
async function syncRoleAfterRemoval(memberId: number) {
  const [m] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);
  if (!m) return;
  const [account] = await db
    .select({ userId: users.userId, role: users.role })
    .from(users)
    .where(eq(users.personId, m.personId))
    .limit(1);
  if (!account || account.role === "ADMIN" || account.role === "SUPER_ADMIN") return;

  const [otherNetwork] = await db
    .select({ id: networkLeader.leaderId })
    .from(networkLeader)
    .where(and(eq(networkLeader.memberId, memberId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (otherNetwork) return; // still a network head elsewhere

  const [headship] = await db
    .select({ id: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  await db
    .update(users)
    .set({ role: headship ? "MINISTRY_HEAD" : "MEMBER" })
    .where(eq(users.userId, account.userId));
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? "");
}

export async function appointNetworkHead(formData: FormData) {
  const session = await requireRole("ADMIN");
  const networkId = Number(formData.get("networkId"));
  const memberId = Number(formData.get("memberId"));
  if (!networkId || !memberId) return { error: "Network and member required" };

  const [existing] = await db
    .select({ id: networkLeader.leaderId })
    .from(networkLeader)
    .where(and(eq(networkLeader.networkId, networkId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (existing) return { error: "This network already has an active head — remove them first" };

  try {
    await db.insert(networkLeader).values({
      networkId,
      memberId,
      appointedBy: await actorMemberId(session.user!.email!),
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "This network already has an active head — remove them first" };
    }
    throw err;
  }

  // Role sync: promote linked account (never demote ADMIN+).
  const [m] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);
  if (m) {
    const [account] = await db
      .select({ userId: users.userId, role: users.role })
      .from(users)
      .where(eq(users.personId, m.personId))
      .limit(1);
    if (account && (account.role === "MEMBER" || account.role === "MINISTRY_HEAD")) {
      await db.update(users).set({ role: "NETWORK_HEAD" }).where(eq(users.userId, account.userId));
    }
  }

  revalidatePath("/users");
  return { success: true };
}

export async function removeNetworkHead(formData: FormData) {
  await requireRole("ADMIN");
  const leaderId = Number(formData.get("leaderId"));
  if (!leaderId) return { error: "Appointment id required" };

  const [row] = await db
    .select({ memberId: networkLeader.memberId })
    .from(networkLeader)
    .where(and(eq(networkLeader.leaderId, leaderId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (!row) return { error: "Active appointment not found" };

  await db
    .update(networkLeader)
    .set({ endedAt: new Date() })
    .where(eq(networkLeader.leaderId, leaderId));
  await syncRoleAfterRemoval(row.memberId);

  revalidatePath("/users");
  return { success: true };
}

/** Active network ids the acting user heads. */
export async function myNetworkIds(): Promise<number[]> {
  const session = await requireRole("NETWORK_HEAD");
  const rows = await db
    .select({ networkId: networkLeader.networkId })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .innerJoin(users, eq(users.personId, member.personId))
    .where(and(eq(users.email, session.user!.email!), isNull(networkLeader.endedAt)));
  return rows.map((r) => r.networkId);
}

/** Network head appoints/removes a chapter HEAD within their own network. */
export async function setChapterHeadAsNetworkHead(formData: FormData) {
  await requireRole("NETWORK_HEAD");
  const membershipId = Number(formData.get("membershipId"));
  const makeHead = formData.get("makeHead") === "1";
  const myNets = await myNetworkIds();

  // Ownership: the membership's chapter must belong to one of my networks.
  const [target] = await db
    .select({ networkId: ministry.networkId })
    .from(ministryMembership)
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(ministryMembership.membershipId, membershipId))
    .limit(1);
  if (!target || !myNets.includes(target.networkId)) {
    return { error: "That chapter is not in your network" };
  }

  const result = await applyChapterHeadChange(membershipId, makeHead);
  revalidatePath("/network-head");
  return result;
}

/** Networks with current head + eligible appointees, for the /users panel. */
export async function networkHeadOverview() {
  const networks = await db
    .select({ networkId: network.networkId, name: network.name })
    .from(network)
    .orderBy(asc(network.name));

  const heads = await db
    .select({
      leaderId: networkLeader.leaderId,
      networkId: networkLeader.networkId,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(isNull(networkLeader.endedAt));

  // Candidates: any active account with a linked member profile.
  const candidates = await db
    .select({
      memberId: member.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: users.email,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.isActive, true))
    .orderBy(asc(person.lastName));

  return { networks, heads, candidates };
}
