# Plan 9: Ministries Admin Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staff-facing ministries admin module — browse ministries grouped by network, manage chapters (ministry × branch), and manage chapter membership (enroll members, end membership, assign leader roles).

**Architecture:** Three new pages under `(admin)/ministries/`, one new Drizzle schema, one new validations file, one new actions file. No migrations — V029–V032 already define all tables. Pattern mirrors existing Programs/Education modules exactly.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM, Zod, Vitest (unit), Playwright (E2E).

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/src/schema/ministries.ts` |
| Create | `app/src/lib/validations/ministries.ts` |
| Create | `app/tests/unit/ministries.test.ts` |
| Create | `app/src/actions/ministries.ts` |
| Create | `app/src/app/(admin)/ministries/page.tsx` |
| Create | `app/src/app/(admin)/ministries/[id]/page.tsx` |
| Create | `app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx` |
| Create | `app/tests/e2e/ministries.spec.ts` |
| Modify | `app/src/app/(admin)/layout.tsx` |

No files deleted. No migrations.

---

### Task 1: Drizzle Schema

**Files:**
- Create: `app/src/schema/ministries.ts`

- [ ] **Step 1: Create schema file**

```typescript
// app/src/schema/ministries.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  date,
  timestamp,
  pgSchema,
} from "drizzle-orm/pg-core";
import { branch } from "./core";
import { member } from "./membership";

export const ministriesSchema = pgSchema("ministries");

export const chapterStatusEnum = ministriesSchema.enum("chapter_status", [
  "ACTIVE",
  "PAUSED",
  "CLOSED",
]);

export const leaderRoleEnum = ministriesSchema.enum("leader_role", [
  "HEAD",
  "ASSISTANT_HEAD",
  "COORDINATOR",
]);

export const network = ministriesSchema.table("network", {
  networkId: bigserial("network_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministry = ministriesSchema.table("ministry", {
  ministryId: bigserial("ministry_id", { mode: "number" }).primaryKey(),
  networkId: bigint("network_id", { mode: "number" })
    .notNull()
    .references(() => network.networkId),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  targetDemographic: text("target_demographic"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministryChapter = ministriesSchema.table("ministry_chapter", {
  chapterId: bigserial("chapter_id", { mode: "number" }).primaryKey(),
  ministryId: bigint("ministry_id", { mode: "number" })
    .notNull()
    .references(() => ministry.ministryId),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  launchedOn: date("launched_on"),
  status: chapterStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministryMembership = ministriesSchema.table("ministry_membership", {
  membershipId: bigserial("membership_id", { mode: "number" }).primaryKey(),
  chapterId: bigint("chapter_id", { mode: "number" })
    .notNull()
    .references(() => ministryChapter.chapterId),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedReason: text("ended_reason"),
  isLeader: boolean("is_leader").notNull().default(false),
  leaderRole: leaderRoleEnum("leader_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/schema/ministries.ts
git commit -m "feat(ministries): add Drizzle schema for ministries module"
```

---

### Task 2: Zod Validations + Unit Tests

**Files:**
- Create: `app/src/lib/validations/ministries.ts`
- Create: `app/tests/unit/ministries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// app/tests/unit/ministries.test.ts
import { describe, it, expect } from "vitest";
import {
  createChapterSchema,
  addMemberSchema,
  endMemberSchema,
} from "@/lib/validations/ministries";

describe("createChapterSchema", () => {
  it("accepts valid input with required fields only", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ACTIVE");
    }
  });

  it("accepts valid input with all fields", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
      launchedOn: "2024-01-15",
      status: "PAUSED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing ministryId", () => {
    const result = createChapterSchema.safeParse({ branchId: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("ministryId");
  });

  it("rejects missing branchId", () => {
    const result = createChapterSchema.safeParse({ ministryId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("branchId");
  });

  it("rejects invalid status value", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts valid non-leader input", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid leader input with role", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: true,
      leaderRole: "HEAD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects isLeader=true without leaderRole", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("leaderRole");
  });

  it("rejects missing joinedAt", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      isLeader: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("joinedAt");
  });

  it("rejects missing chapterId", () => {
    const result = addMemberSchema.safeParse({
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("chapterId");
  });

  it("defaults isLeader to false", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isLeader).toBe(false);
    }
  });
});

describe("endMemberSchema", () => {
  it("accepts valid input with reason", () => {
    const result = endMemberSchema.safeParse({
      membershipId: 10,
      endedAt: "2024-06-01",
      endedReason: "Graduated",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input without reason", () => {
    const result = endMemberSchema.safeParse({
      membershipId: 10,
      endedAt: "2024-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing membershipId", () => {
    const result = endMemberSchema.safeParse({ endedAt: "2024-06-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("membershipId");
  });

  it("rejects missing endedAt", () => {
    const result = endMemberSchema.safeParse({ membershipId: 10 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("endedAt");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd app && npx vitest run tests/unit/ministries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create validations file**

```typescript
// app/src/lib/validations/ministries.ts
import { z } from "zod";

export const createChapterSchema = z.object({
  ministryId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  launchedOn: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]).default("ACTIVE"),
});

export const addMemberSchema = z
  .object({
    chapterId: z.number().int().positive(),
    memberId: z.number().int().positive(),
    joinedAt: z.string().min(1, "Join date required"),
    isLeader: z.boolean().default(false),
    leaderRole: z
      .enum(["HEAD", "ASSISTANT_HEAD", "COORDINATOR"])
      .optional(),
  })
  .refine((d) => !d.isLeader || d.leaderRole != null, {
    message: "Leader role required when isLeader is true",
    path: ["leaderRole"],
  });

export const endMemberSchema = z.object({
  membershipId: z.number().int().positive(),
  endedAt: z.string().min(1, "End date required"),
  endedReason: z.string().optional(),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type EndMemberInput = z.infer<typeof endMemberSchema>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd app && npx vitest run tests/unit/ministries.test.ts
```

Expected: 14 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd app && npx vitest run
```

Expected: all tests pass (previous 34 + 14 new = 48 total).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/validations/ministries.ts app/tests/unit/ministries.test.ts
git commit -m "feat(ministries): add Zod validations and unit tests"
```

---

### Task 3: Server Actions

**Files:**
- Create: `app/src/actions/ministries.ts`

- [ ] **Step 1: Create actions file**

```typescript
// app/src/actions/ministries.ts
"use server";

import { db } from "@/lib/db";
import { person } from "@/schema/core";
import { branch } from "@/schema/core";
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
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ilike, or, count } from "drizzle-orm";

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
    .orderBy(network.name, ministry.name);

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
    .where(isNull(ministryMembership.endedAt))
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        eq(member.status, "ACTIVE"),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ status })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryChapter.chapterId, chapterId as any));

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

export async function setLeaderRole(
  membershipId: number,
  isLeader: boolean,
  leaderRole?: string
): Promise<{ success: true } | { error: string }> {
  if (isLeader && !leaderRole) {
    return { error: "Leader role required" };
  }

  try {
    await db
      .update(ministryMembership)
      .set({
        isLeader,
        leaderRole: isLeader ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR") : null,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(ministryMembership.membershipId, membershipId as any));

    revalidatePath(`/ministries`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update leader role" };
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/ministries.ts
git commit -m "feat(ministries): add server actions for ministries module"
```

---

### Task 4: Ministry List Page

**Files:**
- Create: `app/src/app/(admin)/ministries/page.tsx`

- [ ] **Step 1: Create ministry list page**

```tsx
// app/src/app/(admin)/ministries/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { getMinistries } from "@/actions/ministries";

export default async function MinistriesPage() {
  const groups = await getMinistries();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>

      {groups.length === 0 ? (
        <p className="text-gray-500 text-sm">No ministries found.</p>
      ) : (
        groups.map((group) => (
          <section key={group.networkId} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-1">
              {group.networkName}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.ministries.map((m) => (
                <Link
                  key={m.ministryId}
                  href={`/ministries/${m.ministryId}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-gray-900">{m.name}</p>
                    <span className="ml-2 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 font-mono">
                      {m.code}
                    </span>
                  </div>
                  {m.targetDemographic && (
                    <p className="mt-1 text-xs text-gray-500">
                      {m.targetDemographic}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(admin)/ministries/page.tsx
git commit -m "feat(ministries): add ministry list page grouped by network"
```

---

### Task 5: Ministry Detail Page

**Files:**
- Create: `app/src/app/(admin)/ministries/[id]/page.tsx`

- [ ] **Step 1: Create ministry detail page**

```tsx
// app/src/app/(admin)/ministries/[id]/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { getMinistry, createChapter } from "@/actions/ministries";
import { revalidatePath } from "next/cache";

export default async function MinistryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { err?: string };
}) {
  const ministryId = Number(params.id);
  const ministryData = await getMinistry(ministryId);
  if (!ministryData) notFound();

  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  const err =
    typeof searchParams.err === "string" ? searchParams.err : undefined;

  async function handleCreateChapter(formData: FormData) {
    "use server";
    const branchId = Number(formData.get("branchId"));
    const launchedOn = formData.get("launchedOn") as string | null;
    const status = (formData.get("status") as string) || "ACTIVE";

    const result = await createChapter({
      ministryId,
      branchId,
      launchedOn: launchedOn || undefined,
      status: status as "ACTIVE" | "PAUSED" | "CLOSED",
    });

    if ("error" in result) {
      redirect(`/ministries/${ministryId}?err=${encodeURIComponent(result.error)}`);
    }

    revalidatePath(`/ministries/${ministryId}`);
    redirect(`/ministries/${ministryId}/chapters/${result.chapterId}`);
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-amber-100 text-amber-700",
    CLOSED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/ministries"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Ministries
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {ministryData.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {ministryData.networkName}
          {ministryData.targetDemographic
            ? ` · ${ministryData.targetDemographic}`
            : ""}
        </p>
      </div>

      {/* Description */}
      {ministryData.description && (
        <p className="text-sm text-gray-600">{ministryData.description}</p>
      )}

      {/* Chapters */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Chapters</h2>

        {ministryData.chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No chapters yet.</p>
        ) : (
          <div className="space-y-2">
            {ministryData.chapters.map((c) => (
              <Link
                key={c.chapterId}
                href={`/ministries/${ministryId}/chapters/${c.chapterId}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.branchName}</p>
                  {c.launchedOn && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Launched{" "}
                      {new Date(c.launchedOn).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {c.activeMemberCount} active
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      statusColors[c.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* New Chapter Form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">New Chapter</h2>

        {err === "chapter_already_exists" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            A chapter for this ministry already exists at that branch.
          </p>
        )}
        {err && err !== "chapter_already_exists" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error: {err}
          </p>
        )}

        <form
          action={handleCreateChapter}
          className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                name="branchId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue="ACTIVE"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Launched On
              </label>
              <input
                type="date"
                name="launchedOn"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create chapter
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(admin)/ministries/[id]/page.tsx
git commit -m "feat(ministries): add ministry detail page with chapters and create form"
```

---

### Task 6: Chapter Detail Page

**Files:**
- Create: `app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx`

- [ ] **Step 1: Create chapter detail page**

```tsx
// app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getChapter,
  searchMembers,
  updateChapterStatus,
  addMember,
  endMembership,
  setLeaderRole,
} from "@/actions/ministries";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const LEADER_ROLE_LABELS: Record<string, string> = {
  HEAD: "Head",
  ASSISTANT_HEAD: "Asst. Head",
  COORDINATOR: "Coordinator",
};

export default async function ChapterDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; cid: string };
  searchParams: { q?: string; addErr?: string; endErr?: string; leaderErr?: string };
}) {
  const ministryId = Number(params.id);
  const chapterId = Number(params.cid);

  const chapter = await getChapter(chapterId);
  if (!chapter) notFound();

  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const memberResults = query.length >= 2 ? await searchMembers(query) : [];

  const addErr =
    typeof searchParams.addErr === "string" ? searchParams.addErr : undefined;
  const endErr =
    typeof searchParams.endErr === "string" ? searchParams.endErr : undefined;
  const leaderErr =
    typeof searchParams.leaderErr === "string" ? searchParams.leaderErr : undefined;

  // ── Server actions ──────────────────────────────────────────────────────

  async function handleUpdateStatus(formData: FormData) {
    "use server";
    const status = formData.get("status") as "ACTIVE" | "PAUSED" | "CLOSED";
    await updateChapterStatus(chapterId, status);
    revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleAddMember(formData: FormData) {
    "use server";
    const memberId = Number(formData.get("memberId"));
    const joinedAt = formData.get("joinedAt") as string;
    const isLeader = formData.get("isLeader") === "true";
    const leaderRole = formData.get("leaderRole") as string | null;

    const result = await addMember({
      chapterId,
      memberId,
      joinedAt,
      isLeader,
      leaderRole: leaderRole || undefined,
    });

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?q=${encodeURIComponent(query)}&addErr=${encodeURIComponent(result.error)}`
      );
    }

    revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleEndMembership(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const endedAt = formData.get("endedAt") as string;
    const endedReason = formData.get("endedReason") as string | null;

    const result = await endMembership({
      membershipId,
      endedAt,
      endedReason: endedReason || undefined,
    });

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?endErr=${encodeURIComponent(result.error)}`
      );
    }

    revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleSetLeader(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const isLeader = formData.get("isLeader") === "true";
    const leaderRole = formData.get("leaderRole") as string | null;

    const result = await setLeaderRole(
      membershipId,
      isLeader,
      leaderRole || undefined
    );

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?leaderErr=${encodeURIComponent(result.error)}`
      );
    }

    revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/ministries/${ministryId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← {chapter.ministryName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {chapter.branchName} Chapter
        </h1>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium mt-1 ${
            STATUS_COLORS[chapter.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {chapter.status}
        </span>
      </div>

      {/* Status control */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">Change Status</h2>
        <form action={handleUpdateStatus} className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={chapter.status}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Update
          </button>
        </form>
      </section>

      {/* Active Members */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Active Members ({chapter.activeMembers.length})
        </h2>

        {endErr && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error ending membership: {endErr}
          </p>
        )}
        {leaderErr && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error updating leader: {leaderErr}
          </p>
        )}

        {chapter.activeMembers.length === 0 ? (
          <p className="text-sm text-gray-500">No active members.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Member
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Joined
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chapter.activeMembers.map((m) => (
                  <tr key={m.membershipId} className="bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{m.memberCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(m.joinedAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {m.isLeader && m.leaderRole ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          {LEADER_ROLE_LABELS[m.leaderRole] ?? m.leaderRole}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {/* Set/Remove Leader */}
                        {m.isLeader ? (
                          <form action={handleSetLeader}>
                            <input
                              type="hidden"
                              name="membershipId"
                              value={m.membershipId}
                            />
                            <input
                              type="hidden"
                              name="isLeader"
                              value="false"
                            />
                            <button
                              type="submit"
                              className="text-xs text-amber-600 hover:text-amber-800 underline"
                            >
                              Remove leader
                            </button>
                          </form>
                        ) : (
                          <form action={handleSetLeader} className="flex items-center gap-1">
                            <input
                              type="hidden"
                              name="membershipId"
                              value={m.membershipId}
                            />
                            <input type="hidden" name="isLeader" value="true" />
                            <select
                              name="leaderRole"
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="HEAD">Head</option>
                              <option value="ASSISTANT_HEAD">Asst. Head</option>
                              <option value="COORDINATOR">Coordinator</option>
                            </select>
                            <button
                              type="submit"
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Set leader
                            </button>
                          </form>
                        )}

                        {/* End membership */}
                        <form action={handleEndMembership} className="flex items-center gap-1">
                          <input
                            type="hidden"
                            name="membershipId"
                            value={m.membershipId}
                          />
                          <input type="hidden" name="endedAt" value={today} />
                          <button
                            type="submit"
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            End
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Member */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Add Member</h2>

        {addErr === "member_already_active" && (
          <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
            That member is already active in this chapter.
          </p>
        )}
        {addErr && addErr !== "member_already_active" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error: {addErr}
          </p>
        )}

        {/* Member search */}
        <form
          method="GET"
          className="flex items-center gap-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search member by name or code…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Search
          </button>
        </form>

        {query.length >= 2 && memberResults.length === 0 && (
          <p className="text-sm text-gray-500">No members found for &quot;{query}&quot;.</p>
        )}

        {memberResults.length > 0 && (
          <div className="space-y-2">
            {memberResults.map((r) => (
              <form
                key={r.memberId}
                action={handleAddMember}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <input type="hidden" name="memberId" value={r.memberId} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{r.memberCode}</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Joined
                  </label>
                  <input
                    type="date"
                    name="joinedAt"
                    defaultValue={today}
                    required
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Leader role
                  </label>
                  <select
                    name="leaderRole"
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    <option value="HEAD">Head</option>
                    <option value="ASSISTANT_HEAD">Asst. Head</option>
                    <option value="COORDINATOR">Coordinator</option>
                  </select>
                </div>

                {/* isLeader derived from leaderRole selection client-side would require JS;
                    instead, pass isLeader=true when leaderRole selected, false otherwise.
                    We use a hidden input overridden by the select via form logic.
                    Since we're server-only, we handle isLeader in the action based on leaderRole. */}
                <input
                  type="hidden"
                  name="isLeader"
                  value="false"
                />

                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

**Important note on isLeader / leaderRole logic:** The `addMember` action derives `isLeader` from whether `leaderRole` is non-empty. Update the action to handle this server-side: if `leaderRole` is provided and non-empty, set `isLeader=true`; otherwise `isLeader=false`. Update `handleAddMember` in the page:

```tsx
async function handleAddMember(formData: FormData) {
  "use server";
  const memberId = Number(formData.get("memberId"));
  const joinedAt = formData.get("joinedAt") as string;
  const leaderRole = formData.get("leaderRole") as string | null;
  const isLeader = !!(leaderRole && leaderRole.trim().length > 0);

  const result = await addMember({
    chapterId,
    memberId,
    joinedAt,
    isLeader,
    leaderRole: isLeader ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR") : undefined,
  });

  if ("error" in result) {
    redirect(
      `/ministries/${ministryId}/chapters/${chapterId}?q=${encodeURIComponent(query)}&addErr=${encodeURIComponent(result.error)}`
    );
  }

  revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
  redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
}
```

Replace the `handleAddMember` in the page with this updated version (remove the hidden `isLeader` input from the form too, since it's now computed server-side).

- [ ] **Step 2: Apply the updated handleAddMember (remove hidden isLeader input from add form)**

In `app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx`:

Replace the `handleAddMember` function body and remove the `<input type="hidden" name="isLeader" value="false" />` from the search results form. The final `handleAddMember` function (inside the page, before the `return`) should be:

```tsx
async function handleAddMember(formData: FormData) {
  "use server";
  const memberId = Number(formData.get("memberId"));
  const joinedAt = formData.get("joinedAt") as string;
  const leaderRole = formData.get("leaderRole") as string | null;
  const isLeader = !!(leaderRole && leaderRole.trim().length > 0);

  const result = await addMember({
    chapterId,
    memberId,
    joinedAt,
    isLeader,
    leaderRole: isLeader
      ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR")
      : undefined,
  });

  if ("error" in result) {
    redirect(
      `/ministries/${ministryId}/chapters/${chapterId}?q=${encodeURIComponent(query)}&addErr=${encodeURIComponent(result.error)}`
    );
  }

  revalidatePath(`/ministries/${ministryId}/chapters/${chapterId}`);
  redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
}
```

And remove the `<input type="hidden" name="isLeader" value="false" />` from the search result form (it's no longer needed).

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx
git commit -m "feat(ministries): add chapter detail page with members and forms"
```

---

### Task 7: Admin Nav + E2E Tests + Build Check

**Files:**
- Modify: `app/src/app/(admin)/layout.tsx`
- Create: `app/tests/e2e/ministries.spec.ts`

- [ ] **Step 1: Add Ministries nav link**

In `app/src/app/(admin)/layout.tsx`, add a "Ministries" link after the Education link:

```tsx
// Current Education link:
<Link
  href="/education/bc/students"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Education
</Link>

// Add after it:
<Link
  href="/ministries"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Ministries
</Link>
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit nav update**

```bash
git add app/src/app/(admin)/layout.tsx
git commit -m "feat(ministries): add Ministries link to admin nav"
```

- [ ] **Step 4: Create E2E test file**

```typescript
// app/tests/e2e/ministries.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', STAFF_EMAIL);
  await page.fill('input[name="password"]', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/members");
}

test.describe("Ministries module", () => {
  test("ministry list loads with network sections", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await expect(
      page.getByRole("heading", { name: "Ministries", level: 1 })
    ).toBeVisible();
    // At least one network section header should be present (seeded data)
    const headers = page.locator("h2");
    const count = await headers.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Ministries nav link is visible in admin layout", async ({ page }) => {
    await staffLogin(page);
    await expect(page.getByRole("link", { name: "Ministries" })).toBeVisible();
  });

  test("clicking a ministry navigates to detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistry = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistry.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistry.click();
    await expect(page).toHaveURL(/\/ministries\/\d+/);
    await expect(
      page.getByRole("link", { name: "← Ministries" })
    ).toBeVisible();
  });

  test("ministry detail shows chapters section and new chapter form", async ({
    page,
  }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistry = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistry.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistry.click();
    await expect(
      page.getByRole("heading", { name: "Chapters" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "New Chapter" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create chapter" })).toBeVisible();
  });
});
```

- [ ] **Step 5: Commit E2E tests**

```bash
git add app/tests/e2e/ministries.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for ministries module"
```

- [ ] **Step 6: Run unit tests**

```bash
cd app && npx vitest run
```

Expected: all tests pass (48 total — 34 previous + 14 new ministries tests).

- [ ] **Step 7: Production build**

```bash
cd app && npm run build
```

Expected: build succeeds. All three ministry pages render as `ƒ` (dynamic).

If build fails with unused import errors, remove the unused imports. If it fails with type errors, fix them and re-run.

- [ ] **Step 8: Commit build fix if needed**

Only if Step 7 required code changes:

```bash
git add -A
git commit -m "fix(build): resolve type/lint errors in ministries module"
```

---

## Self-Review

**Spec coverage:**
- ✅ `schema/ministries.ts` — Task 1
- ✅ `lib/validations/ministries.ts` — Task 2
- ✅ Unit tests (14 tests) — Task 2
- ✅ `actions/ministries.ts` — Task 3 (getMinistries, getMinistry, getChapter, searchMembers, createChapter, updateChapterStatus, addMember, endMembership, setLeaderRole)
- ✅ `/ministries` ministry list grouped by network — Task 4
- ✅ `/ministries/[id]` ministry detail + chapters table + create chapter form — Task 5
- ✅ Duplicate chapter guard (ministry+branch) — Task 5 (action) + Task 5 (page error display)
- ✅ `/ministries/[id]/chapters/[cid]` chapter detail + status control + active members + add member + end + leader — Task 6
- ✅ Active member only guard in addMember — Task 3
- ✅ isLeader/leaderRole constraint (Zod refine + server-side derivation) — Tasks 2, 3, 6
- ✅ Append-only membership (endedAt not delete) — Task 3
- ✅ Member search (searchMembers) by name/memberCode — Task 3
- ✅ Admin nav link — Task 7
- ✅ E2E tests — Task 7
- ✅ Build check — Task 7

**Type consistency:**
- `mode: "number"` used throughout schema (matches existing pattern)
- `as any` cast for bigint fields in where/insert (matches existing pattern)
- `isLeader` derived from `leaderRole` presence in chapter detail page (consistent with Zod schema refine)
- All action return types `{ success: true; ... } | { error: string }` (consistent pattern)
- `ChapterDetail.status` typed as union string literal (cast from Drizzle enum)
