# Ministries Leaders Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/ministries` into a 2-column layout — left panel shows network/ministry tree with inline add/close actions and leader sub-headers; right sticky panel shows all appointed Network Heads, Ministry Heads, and Inner Core per chapter with appoint/remove controls and a member-search modal.

**Architecture:** Two new Flyway migrations add the `network_leader` table and `is_inner_core` column. A new `ministry-leaders.ts` actions file handles all appointment mutations. The page is rebuilt as a server component with small focused client components for interactive slots (AppointModal, LeaderSlot, AddMinistryForm, CloseMinistryButton).

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, PostgreSQL 16, Tailwind CSS, TypeScript strict, Flyway migrations, Vitest unit tests

---

## File Map

| Action | Path |
|---|---|
| Create | `db/migrations/V073__ministries_network_leader.sql` |
| Create | `db/migrations/V074__ministry_membership_inner_core.sql` |
| Modify | `app/src/schema/ministries.ts` |
| Create | `app/src/actions/ministry-leaders.ts` |
| Modify | `app/src/actions/ministries.ts` |
| Rewrite | `app/src/app/(admin)/ministries/page.tsx` |
| Create | `app/src/components/ministries/network-tree.tsx` |
| Create | `app/src/components/ministries/add-ministry-form.tsx` |
| Create | `app/src/components/ministries/close-ministry-button.tsx` |
| Create | `app/src/components/ministries/leaders-sidebar.tsx` |
| Create | `app/src/components/ministries/leader-slot.tsx` |
| Create | `app/src/components/ministries/appoint-modal.tsx` |
| Create | `app/tests/unit/ministry-leaders.test.ts` |

---

### Task 1: V073 migration — `ministries.network_leader` table

**Files:**
- Create: `db/migrations/V073__ministries_network_leader.sql`

- [ ] **Step 1: Write migration**

```sql
-- V073: Network head appointments (one active head per network, append-only history)
CREATE TABLE ministries.network_leader (
  leader_id    BIGSERIAL PRIMARY KEY,
  network_id   BIGINT NOT NULL REFERENCES ministries.network(network_id) ON DELETE CASCADE,
  member_id    BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  appointed_by BIGINT REFERENCES membership.member(member_id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active (ended_at IS NULL) head per network
CREATE UNIQUE INDEX one_active_head_per_network
  ON ministries.network_leader(network_id) WHERE ended_at IS NULL;

CREATE INDEX idx_network_leader_member ON ministries.network_leader(member_id);

COMMENT ON TABLE ministries.network_leader IS
  'Network head appointments. One active head per network (partial unique on ended_at IS NULL).';
```

- [ ] **Step 2: Apply migration locally**

```bash
cd db && docker compose up -d
```

Expected: Flyway output includes `Migrating schema "ministries" to version 073`.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/V073__ministries_network_leader.sql
git commit -m "feat(db): V073 ministries.network_leader appointment table"
```

---

### Task 2: V074 migration — `is_inner_core` column + Drizzle schema

**Files:**
- Create: `db/migrations/V074__ministry_membership_inner_core.sql`
- Modify: `app/src/schema/ministries.ts`

- [ ] **Step 1: Write migration**

```sql
-- V074: Inner Core designation per chapter membership
ALTER TABLE ministries.ministry_membership
  ADD COLUMN is_inner_core BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_ministry_membership_inner_core
  ON ministries.ministry_membership(chapter_id) WHERE is_inner_core = true AND ended_at IS NULL;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd db && docker compose up -d
```

Expected: Flyway output includes `Migrating schema "ministries" to version 074`.

- [ ] **Step 3: Add `networkLeader` table + `isInnerCore` field to Drizzle schema**

In `app/src/schema/ministries.ts`, after the `joinRequest` table export, add:

```typescript
export const networkLeader = ministriesSchema.table("network_leader", {
  leaderId: bigserial("leader_id", { mode: "number" }).primaryKey(),
  networkId: bigint("network_id", { mode: "number" })
    .notNull()
    .references(() => network.networkId, { onDelete: "cascade" }),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId, { onDelete: "cascade" }),
  appointedBy: bigint("appointed_by", { mode: "number" }).references(
    () => member.memberId
  ),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

Also add `isInnerCore` field to `ministryMembership` table (after the `priority` field):

```typescript
  isInnerCore: boolean("is_inner_core").notNull().default(false),
```

- [ ] **Step 4: Add missing imports**

The `ministries.ts` schema file already imports `boolean` from `drizzle-orm/pg-core`. Verify `timestamp` is also imported (it is — used by existing tables). No new imports needed.

- [ ] **Step 5: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only the pre-existing `tests/unit/stage-promotion.test.ts` error. No new errors.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V074__ministry_membership_inner_core.sql app/src/schema/ministries.ts
git commit -m "feat(db): V074 is_inner_core column; Drizzle networkLeader table + isInnerCore field"
```

---

### Task 3: `ministry-leaders.ts` server actions

**Files:**
- Create: `app/src/actions/ministry-leaders.ts`
- Create: `app/tests/unit/ministry-leaders.test.ts`

- [ ] **Step 1: Write unit tests first**

```typescript
// app/tests/unit/ministry-leaders.test.ts
import { describe, it, expect } from "vitest";
import { buildLeaderSearchWhere } from "@/actions/ministry-leaders";

describe("buildLeaderSearchWhere — appointment type eligibility", () => {
  it("NETWORK_HEAD requires head-eligible stage", () => {
    const result = buildLeaderSearchWhere("NETWORK_HEAD");
    expect(result.requiresHeadEligible).toBe(true);
    expect(result.requiresChapterMember).toBe(false);
  });

  it("MINISTRY_HEAD requires head-eligible stage and chapter membership", () => {
    const result = buildLeaderSearchWhere("MINISTRY_HEAD");
    expect(result.requiresHeadEligible).toBe(true);
    expect(result.requiresChapterMember).toBe(true);
  });

  it("INNER_CORE requires chapter membership only", () => {
    const result = buildLeaderSearchWhere("INNER_CORE");
    expect(result.requiresHeadEligible).toBe(false);
    expect(result.requiresChapterMember).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd app && npx vitest run tests/unit/ministry-leaders.test.ts
```

Expected: FAIL — `buildLeaderSearchWhere` not defined.

- [ ] **Step 3: Write the actions file**

```typescript
// app/src/actions/ministry-leaders.ts
"use server";

import { db } from "@/lib/db";
import { person, branch } from "@/schema/core";
import { member, lifecycleStage } from "@/schema/membership";
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
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ilike, or, inArray } from "drizzle-orm";

// ─── Pure helper (exported for unit tests) ───────────────────────────────────

export type AppointmentType = "NETWORK_HEAD" | "MINISTRY_HEAD" | "INNER_CORE";

export function buildLeaderSearchWhere(type: AppointmentType): {
  requiresHeadEligible: boolean;
  requiresChapterMember: boolean;
} {
  return {
    requiresHeadEligible: type === "NETWORK_HEAD" || type === "MINISTRY_HEAD",
    requiresChapterMember: type === "MINISTRY_HEAD" || type === "INNER_CORE",
  };
}

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
  // All networks
  const networks = await db
    .select({ networkId: network.networkId, networkName: network.name })
    .from(network)
    .orderBy(network.name);

  // All active network heads
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

  const headMap = new Map(
    activeHeads.map((h) => [h.networkId, h])
  );

  // All active ministry chapters with their ministry + branch
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

  // Ministry heads (is_leader=true, leader_role='HEAD')
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

  // Inner core members
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

  // Group chapters by network
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
    // Must be an active chapter member
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
    // Any active member
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
    // End any existing active head
    await db
      .update(networkLeader)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(networkLeader.networkId, networkId as unknown as number),
          isNull(networkLeader.endedAt)
        )
      );

    // Appoint new head
    await db.insert(networkLeader).values({
      networkId: networkId as unknown as number,
      memberId: memberId as unknown as number,
    });

    // Promote linked user account
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

    // Demote user if no longer a network head elsewhere
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

  // Must be an active chapter member
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
    // Clear any existing HEAD in this chapter
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

    // Set new head
    await db
      .update(ministryMembership)
      .set({ isLeader: true, leaderRole: "HEAD" })
      .where(
        eq(
          ministryMembership.membershipId,
          membership.membershipId as unknown as number
        )
      );

    // Promote user account
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

    // Demote if no longer leads any chapter
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

    // Create a default chapter using the first active branch
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
```

- [ ] **Step 4: Run unit tests**

```bash
cd app && npx vitest run tests/unit/ministry-leaders.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing `stage-promotion.test.ts` error.

- [ ] **Step 6: Commit**

```bash
git add app/src/actions/ministry-leaders.ts app/tests/unit/ministry-leaders.test.ts
git commit -m "feat(actions): ministry-leaders appointment/removal + member search"
```

---

### Task 4: Update `getMinistries` to include leader sub-header data

**Files:**
- Modify: `app/src/actions/ministries.ts`

The left panel needs each ministry's current Ministry Head name. Update `NetworkGroup` type and `getMinistries` query.

- [ ] **Step 1: Update `NetworkGroup` type in `ministries.ts`**

Change the `ministries` array item type from:
```typescript
ministries: {
  ministryId: number;
  name: string;
  code: string;
  targetDemographic: string | null;
}[];
```

To:
```typescript
ministries: {
  ministryId: number;
  name: string;
  code: string;
  targetDemographic: string | null;
  headName: string | null;
}[];
```

- [ ] **Step 2: Update `getMinistries` query to fetch head names**

Replace the `getMinistries` function body with:

```typescript
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

  if (rows.length === 0) return [];

  // Fetch ministry heads for all ministries
  const ministryIds = rows.map((r) => r.ministryId);
  const heads = await db
    .select({
      ministryId: ministry.ministryId,
      firstName: person.firstName,
      lastName: person.lastName,
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
        inArray(ministry.ministryId, ministryIds),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(ministryIds.length);

  const headMap = new Map(
    heads.map((h) => [h.ministryId, `${h.lastName}, ${h.firstName}`])
  );

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
      headName: headMap.get(row.ministryId) ?? null,
    });
  }

  return Array.from(grouped.entries()).map(([networkId, g]) => ({
    networkId,
    networkName: g.networkName,
    ministries: g.ministries,
  }));
}
```

- [ ] **Step 3: Add `inArray` to imports in `ministries.ts`**

The import line is:
```typescript
import { and, eq, isNull, ilike, or, count, asc } from "drizzle-orm";
```

Change to:
```typescript
import { and, eq, isNull, ilike, or, count, asc, inArray } from "drizzle-orm";
```

- [ ] **Step 4: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing error.

- [ ] **Step 5: Commit**

```bash
git add app/src/actions/ministries.ts
git commit -m "feat(actions): getMinistries includes Ministry Head name per ministry"
```

---

### Task 5: `LeadersSidebar` server component

**Files:**
- Create: `app/src/components/ministries/leaders-sidebar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/src/components/ministries/leaders-sidebar.tsx
import { NetworkLeadersData } from "@/actions/ministry-leaders";
import { LeaderSlot } from "./leader-slot";

export function LeadersSidebar({ data }: { data: NetworkLeadersData[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic">No networks found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Leaders
      </h2>
      {data.map((net) => (
        <div key={net.networkId} className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-1">
            {net.networkName}
          </h3>

          {/* Network Head */}
          <div className="pl-2 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Network Head
            </p>
            <LeaderSlot
              type="NETWORK_HEAD"
              networkId={net.networkId}
              head={net.networkHead}
            />
          </div>

          {/* Chapters */}
          {net.chapters.map((ch) => (
            <div key={ch.chapterId} className="pl-2 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                {ch.ministryName}
                {net.chapters.filter((c) => c.ministryId === ch.ministryId)
                  .length > 1 && (
                  <span className="ml-1 text-gray-400">· {ch.branchName}</span>
                )}
              </p>

              {/* Ministry Head */}
              <div className="pl-3 space-y-1">
                <p className="text-xs text-gray-400">Ministry Head</p>
                <LeaderSlot
                  type="MINISTRY_HEAD"
                  chapterId={ch.chapterId}
                  head={ch.head}
                />
              </div>

              {/* Inner Core */}
              <div className="pl-3 space-y-1">
                <p className="text-xs text-gray-400">
                  Inner Core ({ch.innerCore.length})
                </p>
                {ch.innerCore.map((ic) => (
                  <LeaderSlot
                    key={ic.membershipId}
                    type="INNER_CORE"
                    chapterId={ch.chapterId}
                    membershipId={ic.membershipId}
                    head={{
                      leaderId: ic.membershipId,
                      memberId: ic.memberId,
                      firstName: ic.firstName,
                      lastName: ic.lastName,
                      memberCode: ic.memberCode,
                    }}
                  />
                ))}
                {/* Always show + Appoint for Inner Core */}
                <LeaderSlot
                  type="INNER_CORE"
                  chapterId={ch.chapterId}
                  head={null}
                  alwaysShowAppoint
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: `LeaderSlot` not defined yet — will be fixed in Task 6. Ignore for now, continue.

- [ ] **Step 3: Commit (stub)**

```bash
git add app/src/components/ministries/leaders-sidebar.tsx
git commit -m "feat(ui): LeadersSidebar server component"
```

---

### Task 6: `LeaderSlot` + `AppointModal` client components

**Files:**
- Create: `app/src/components/ministries/leader-slot.tsx`
- Create: `app/src/components/ministries/appoint-modal.tsx`

- [ ] **Step 1: Create `AppointModal`**

```typescript
// app/src/components/ministries/appoint-modal.tsx
"use client";

import { useState, useTransition, useCallback } from "react";
import {
  searchEligibleMembers,
  appointNetworkHead,
  appointMinistryHead,
  appointInnerCore,
  EligibleMember,
  AppointmentType,
} from "@/actions/ministry-leaders";

type Props = {
  type: AppointmentType;
  networkId?: number;
  chapterId?: number;
  title: string;
  onClose: () => void;
};

export function AppointModal({
  type,
  networkId,
  chapterId,
  title,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EligibleMember[]>([]);
  const [selected, setSelected] = useState<EligibleMember | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    setSelected(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const found = await searchEligibleMembers(q, type, chapterId);
      setResults(found);
    } finally {
      setSearching(false);
    }
  }, [type, chapterId]);

  const handleConfirm = () => {
    if (!selected) return;
    startTransition(async () => {
      let result: { success: true } | { error: string };
      if (type === "NETWORK_HEAD" && networkId) {
        result = await appointNetworkHead(networkId, selected.memberId);
      } else if (type === "MINISTRY_HEAD" && chapterId) {
        result = await appointMinistryHead(chapterId, selected.memberId);
      } else if (type === "INNER_CORE" && chapterId) {
        result = await appointInnerCore(chapterId, selected.memberId);
      } else {
        return;
      }
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {searching && (
          <p className="text-xs text-gray-400 text-center">Searching…</p>
        )}

        {results.length > 0 && (
          <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <li key={r.memberId}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    selected?.memberId === r.memberId
                      ? "bg-blue-50 font-medium"
                      : ""
                  }`}
                >
                  <span className="font-medium">
                    {r.lastName}, {r.firstName}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {r.currentStage} · {r.branchName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center">No eligible members found.</p>
        )}

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={handleConfirm}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {pending ? "Appointing…" : "Confirm Appoint"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `LeaderSlot`**

```typescript
// app/src/components/ministries/leader-slot.tsx
"use client";

import { useState, useTransition } from "react";
import {
  removeNetworkHead,
  removeMinistryHead,
  removeInnerCore,
  AppointmentType,
} from "@/actions/ministry-leaders";
import { AppointModal } from "./appoint-modal";

type HeadInfo = {
  leaderId: number;
  memberId: number;
  firstName: string;
  lastName: string;
  memberCode: string;
};

type Props = {
  type: AppointmentType;
  networkId?: number;
  chapterId?: number;
  membershipId?: number;
  head: HeadInfo | null;
  alwaysShowAppoint?: boolean;
};

export function LeaderSlot({
  type,
  networkId,
  chapterId,
  membershipId,
  head,
  alwaysShowAppoint,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [pending, startTransition] = useTransition();

  const modalTitle =
    type === "NETWORK_HEAD"
      ? "Appoint Network Head"
      : type === "MINISTRY_HEAD"
      ? "Appoint Ministry Head"
      : "Appoint Inner Core";

  const handleRemove = () => {
    startTransition(async () => {
      if (type === "NETWORK_HEAD" && networkId) {
        await removeNetworkHead(networkId);
      } else if (type === "MINISTRY_HEAD" && chapterId) {
        await removeMinistryHead(chapterId);
      } else if (type === "INNER_CORE" && membershipId) {
        await removeInnerCore(membershipId);
      }
    });
  };

  // Inner Core "always show appoint" slot (add another)
  if (alwaysShowAppoint && !head) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span> Appoint
        </button>
        {showModal && (
          <AppointModal
            type={type}
            chapterId={chapterId}
            networkId={networkId}
            title={modalTitle}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  if (!head) {
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 italic">Vacant</span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> Appoint
          </button>
        </div>
        {showModal && (
          <AppointModal
            type={type}
            chapterId={chapterId}
            networkId={networkId}
            title={modalTitle}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-800 font-medium">
        {head.lastName}, {head.firstName}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={handleRemove}
        title="Remove"
        className="text-gray-400 hover:text-red-500 text-xs disabled:opacity-40 transition-colors flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing error.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ministries/leader-slot.tsx app/src/components/ministries/appoint-modal.tsx
git commit -m "feat(ui): LeaderSlot + AppointModal client components"
```

---

### Task 7: `NetworkTree`, `AddMinistryForm`, `CloseMinistryButton` components

**Files:**
- Create: `app/src/components/ministries/network-tree.tsx`
- Create: `app/src/components/ministries/add-ministry-form.tsx`
- Create: `app/src/components/ministries/close-ministry-button.tsx`

- [ ] **Step 1: Create `CloseMinistryButton`**

```typescript
// app/src/components/ministries/close-ministry-button.tsx
"use client";

import { useTransition } from "react";
import { closeMinistry } from "@/actions/ministry-leaders";

export function CloseMinistryButton({ ministryId }: { ministryId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title="Close ministry"
      onClick={() => {
        if (confirm("Close this ministry? All chapters will be marked CLOSED.")) {
          startTransition(async () => {
            await closeMinistry(ministryId);
          });
        }
      }}
      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Create `AddMinistryForm`**

```typescript
// app/src/components/ministries/add-ministry-form.tsx
"use client";

import { useState, useTransition, useRef } from "react";
import { addMinistry } from "@/actions/ministry-leaders";

export function AddMinistryForm({ networkId }: { networkId: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addMinistry(networkId, name.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        setName("");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
      >
        <span className="text-base leading-none font-medium">+</span> Add ministry
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setOpen(false); setName(""); }
        }}
        placeholder="Ministry name…"
        className="rounded-md border border-gray-300 px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={pending}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !name.trim()}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {pending ? "…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setName(""); }}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `NetworkTree` server component**

```typescript
// app/src/components/ministries/network-tree.tsx
import Link from "next/link";
import { NetworkGroup } from "@/actions/ministries";
import { AddMinistryForm } from "./add-ministry-form";
import { CloseMinistryButton } from "./close-ministry-button";

export function NetworkTree({ groups }: { groups: NetworkGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-gray-400">No ministries found.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.networkId} className="space-y-2">
          <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-1">
            {group.networkName}
          </h2>

          <div className="space-y-1">
            {group.ministries.map((m) => (
              <div
                key={m.ministryId}
                className="flex items-start justify-between group rounded-lg px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <Link
                    href={`/ministries/${m.ministryId}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.headName ?? (
                      <span className="italic">Vacant</span>
                    )}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CloseMinistryButton ministryId={m.ministryId} />
                </div>
              </div>
            ))}
          </div>

          <AddMinistryForm networkId={group.networkId} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing error.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ministries/network-tree.tsx app/src/components/ministries/add-ministry-form.tsx app/src/components/ministries/close-ministry-button.tsx
git commit -m "feat(ui): NetworkTree + AddMinistryForm + CloseMinistryButton components"
```

---

### Task 8: Rewrite `/ministries/page.tsx`

**Files:**
- Rewrite: `app/src/app/(admin)/ministries/page.tsx`

- [ ] **Step 1: Rewrite the page**

```typescript
// app/src/app/(admin)/ministries/page.tsx
export const dynamic = "force-dynamic";

import { getMinistries } from "@/actions/ministries";
import { getLeadersSidebarData } from "@/actions/ministry-leaders";
import { NetworkTree } from "@/components/ministries/network-tree";
import { LeadersSidebar } from "@/components/ministries/leaders-sidebar";

export default async function MinistriesPage() {
  const [groups, leadersData] = await Promise.all([
    getMinistries(),
    getLeadersSidebarData(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>

      <div className="flex gap-8 items-start">
        {/* Left: Network + ministry tree */}
        <div className="flex-1 min-w-0">
          <NetworkTree groups={groups} />
        </div>

        {/* Right: Sticky leaders panel */}
        <div className="w-72 flex-shrink-0 sticky top-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <LeadersSidebar data={leadersData} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing error.

- [ ] **Step 3: Commit**

```bash
git add "app/src/app/(admin)/ministries/page.tsx"
git commit -m "feat(ministries): 2-col layout — NetworkTree left + LeadersSidebar right"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run all unit tests**

```bash
cd app && npx vitest run
```

Expected: all tests pass (baseline + 3 new ministry-leaders tests).

- [ ] **Step 2: Run tsc**

```bash
cd app && npx tsc --noEmit
```

Expected: only pre-existing `stage-promotion.test.ts` error.

- [ ] **Step 3: Run production build**

```bash
cd app && npm run build
```

Expected: build succeeds, no type errors, no missing module errors.

- [ ] **Step 4: Start dev server and smoke-test**

```bash
cd app && DATABASE_URL=postgresql://jly_admin:localdevpassword@localhost:5432/jly DATABASE_URL_READER=postgresql://jly_admin:localdevpassword@localhost:5432/jly npm run dev
```

Open http://localhost:3000/ministries. Verify:
- 2-column layout renders
- Ministry names show leader sub-text (or "Vacant")
- `[+ Add ministry]` button appears per network
- Hover a ministry row → close `×` icon appears
- Right panel shows leaders grouped by network
- Clicking `[+ Appoint]` opens modal with search
- Typing 2+ chars returns eligible members
- Selecting + Confirm Appoint calls action (check logs)
- `×` Remove button removes a head

- [ ] **Step 5: Commit verification note**

```bash
git commit --allow-empty -m "chore: ministries leaders redesign verified — tsc clean, build clean, smoke tested"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Migrations to run on Neon before deploy

```
V073__ministries_network_leader.sql
V074__ministry_membership_inner_core.sql
```

Run via dockerized Flyway against the Neon DATABASE_URL, then deploy to Vercel.
