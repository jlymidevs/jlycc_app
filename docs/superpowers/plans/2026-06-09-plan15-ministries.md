# Plan 15 — Ministries Admin Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin UI for browsing ministries, managing chapters (ministry presence per branch), and enrolling/removing members from chapters.

**Architecture:** Read-only ministry/network data (seeded). Staff can create chapters, update chapter status, enroll members (with optional leader role), and soft-end memberships. Follows the Programs (Plan 7) and Education (Plan 8) patterns exactly — Zod schemas, server actions, admin pages under `/(admin)/ministries/`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Drizzle ORM, Zod, Tailwind, Vitest, Playwright.

---

## Schema Reference

```
ministries.network          — top-level groupings (EAGLES, WIND, LEAD_TAKERS) — seeded, read-only
ministries.ministry         — ministries per network (9 seeded) — read-only
ministries.ministry_chapter — ministry presence at a branch (ACTIVE/PAUSED/CLOSED) — staff-managed
ministries.ministry_membership — member enrollment in a chapter — staff-managed
```

Key enums:
- `chapter_status`: `ACTIVE | PAUSED | CLOSED`
- `leader_role`: `HEAD | ASSISTANT_HEAD | COORDINATOR`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/src/lib/validations/ministries.ts` | Create — Zod schemas |
| `app/src/actions/ministries.ts` | Create — 6 server actions |
| `app/src/app/(admin)/ministries/page.tsx` | Create — ministry list |
| `app/src/app/(admin)/ministries/[id]/page.tsx` | Create — ministry detail + chapters |
| `app/src/app/(admin)/ministries/[id]/chapters/new/page.tsx` | Create — add chapter form |
| `app/src/app/(admin)/ministries/[id]/chapters/[chapterId]/page.tsx` | Create — chapter detail + members |
| `app/src/app/(admin)/layout.tsx` | Modify — add Ministries nav link |
| `app/tests/unit/ministries.test.ts` | Create — Zod unit tests |
| `app/tests/e2e/ministries.spec.ts` | Create — E2E tests |

No DB migration needed — V029–V032 already exist.

---

## Task 1 — Zod Schemas + Unit Tests

**Files:**
- Create: `app/src/lib/validations/ministries.ts`
- Create: `app/tests/unit/ministries.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `app/tests/unit/ministries.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createChapterSchema,
  updateChapterStatusSchema,
  addMemberSchema,
  removeMemberSchema,
} from "@/lib/validations/ministries";

describe("createChapterSchema", () => {
  it("accepts valid input with required fields only", () => {
    expect(createChapterSchema.safeParse({ ministryId: 1, branchId: 2 }).success).toBe(true);
  });
  it("accepts valid input with launchedOn", () => {
    expect(createChapterSchema.safeParse({ ministryId: 1, branchId: 2, launchedOn: "2024-01-15" }).success).toBe(true);
  });
  it("rejects missing ministryId", () => {
    expect(createChapterSchema.safeParse({ branchId: 2 }).success).toBe(false);
  });
  it("rejects missing branchId", () => {
    expect(createChapterSchema.safeParse({ ministryId: 1 }).success).toBe(false);
  });
  it("rejects non-positive ministryId", () => {
    expect(createChapterSchema.safeParse({ ministryId: 0, branchId: 2 }).success).toBe(false);
  });
  it("rejects non-positive branchId", () => {
    expect(createChapterSchema.safeParse({ ministryId: 1, branchId: 0 }).success).toBe(false);
  });
});

describe("updateChapterStatusSchema", () => {
  it("accepts ACTIVE", () => {
    expect(updateChapterStatusSchema.safeParse({ chapterId: 1, status: "ACTIVE" }).success).toBe(true);
  });
  it("accepts PAUSED", () => {
    expect(updateChapterStatusSchema.safeParse({ chapterId: 1, status: "PAUSED" }).success).toBe(true);
  });
  it("accepts CLOSED", () => {
    expect(updateChapterStatusSchema.safeParse({ chapterId: 1, status: "CLOSED" }).success).toBe(true);
  });
  it("rejects invalid status", () => {
    expect(updateChapterStatusSchema.safeParse({ chapterId: 1, status: "UNKNOWN" }).success).toBe(false);
  });
  it("rejects missing chapterId", () => {
    expect(updateChapterStatusSchema.safeParse({ status: "ACTIVE" }).success).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts valid input without leader role", () => {
    expect(addMemberSchema.safeParse({ chapterId: 1, memberId: 2, joinedAt: "2024-01-15T00:00:00Z", isLeader: false }).success).toBe(true);
  });
  it("accepts valid input with leader role", () => {
    expect(addMemberSchema.safeParse({ chapterId: 1, memberId: 2, joinedAt: "2024-01-15T00:00:00Z", isLeader: true, leaderRole: "HEAD" }).success).toBe(true);
  });
  it("rejects missing chapterId", () => {
    expect(addMemberSchema.safeParse({ memberId: 2, joinedAt: "2024-01-15T00:00:00Z", isLeader: false }).success).toBe(false);
  });
  it("rejects missing memberId", () => {
    expect(addMemberSchema.safeParse({ chapterId: 1, joinedAt: "2024-01-15T00:00:00Z", isLeader: false }).success).toBe(false);
  });
  it("rejects missing joinedAt", () => {
    expect(addMemberSchema.safeParse({ chapterId: 1, memberId: 2, isLeader: false }).success).toBe(false);
  });
  it("rejects invalid leaderRole", () => {
    expect(addMemberSchema.safeParse({ chapterId: 1, memberId: 2, joinedAt: "2024-01-15T00:00:00Z", isLeader: true, leaderRole: "BOSS" }).success).toBe(false);
  });
});

describe("removeMemberSchema", () => {
  it("accepts membershipId only", () => {
    expect(removeMemberSchema.safeParse({ membershipId: 1 }).success).toBe(true);
  });
  it("accepts membershipId with reason", () => {
    expect(removeMemberSchema.safeParse({ membershipId: 1, endedReason: "Transferred" }).success).toBe(true);
  });
  it("rejects missing membershipId", () => {
    expect(removeMemberSchema.safeParse({}).success).toBe(false);
  });
  it("rejects non-positive membershipId", () => {
    expect(removeMemberSchema.safeParse({ membershipId: 0 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npx vitest run tests/unit/ministries.test.ts
```

Expected: FAIL — schemas not found.

- [ ] **Step 3: Create Zod schemas**

Create `app/src/lib/validations/ministries.ts`:

```typescript
import { z } from "zod";

export const createChapterSchema = z.object({
  ministryId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  launchedOn: z.string().optional(),
});

export const updateChapterStatusSchema = z.object({
  chapterId: z.number().int().positive(),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]),
});

export const addMemberSchema = z.object({
  chapterId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  joinedAt: z.string().datetime({ offset: true }),
  isLeader: z.boolean(),
  leaderRole: z.enum(["HEAD", "ASSISTANT_HEAD", "COORDINATOR"]).optional(),
});

export const removeMemberSchema = z.object({
  membershipId: z.number().int().positive(),
  endedReason: z.string().optional(),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterStatusInput = z.infer<typeof updateChapterStatusSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd app && npx vitest run tests/unit/ministries.test.ts
```

Expected: 22 tests passing.

- [ ] **Step 5: Run full unit suite**

```bash
cd app && npx vitest run
```

Expected: 216 + 22 = 238 tests passing.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/validations/ministries.ts app/tests/unit/ministries.test.ts
git commit -m "feat(ministries): add Zod validation schemas and unit tests"
```

---

## Task 2 — Server Actions

**Files:**
- Create: `app/src/actions/ministries.ts`

- [ ] **Step 1: Create server actions**

Create `app/src/actions/ministries.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import {
  network,
  ministry,
  ministryChapter,
  ministryMembership,
} from "@/schema/ministries";
import { branch } from "@/schema/core";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import {
  createChapterSchema,
  updateChapterStatusSchema,
  addMemberSchema,
  removeMemberSchema,
  CreateChapterInput,
  UpdateChapterStatusInput,
  AddMemberInput,
  RemoveMemberInput,
} from "@/lib/validations/ministries";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function listMinistries() {
  const rows = await db
    .select({
      ministryId: ministry.ministryId,
      code: ministry.code,
      name: ministry.name,
      description: ministry.description,
      targetDemographic: ministry.targetDemographic,
      networkName: network.name,
      networkCode: network.code,
      chapterCount: count(ministryChapter.chapterId),
    })
    .from(ministry)
    .innerJoin(network, eq(ministry.networkId, network.networkId))
    .leftJoin(ministryChapter, eq(ministryChapter.ministryId, ministry.ministryId))
    .groupBy(
      ministry.ministryId,
      ministry.code,
      ministry.name,
      ministry.description,
      ministry.targetDemographic,
      network.name,
      network.code
    )
    .orderBy(network.name, ministry.name);

  return rows;
}

export async function getMinistry(id: number) {
  const [row] = await db
    .select({
      ministryId: ministry.ministryId,
      code: ministry.code,
      name: ministry.name,
      description: ministry.description,
      targetDemographic: ministry.targetDemographic,
      foundedOn: ministry.foundedOn,
      networkName: network.name,
    })
    .from(ministry)
    .innerJoin(network, eq(ministry.networkId, network.networkId))
    .where(eq(ministry.ministryId, id))
    .limit(1);

  if (!row) return null;

  const chapters = await db
    .select({
      chapterId: ministryChapter.chapterId,
      branchName: branch.name,
      branchId: ministryChapter.branchId,
      launchedOn: ministryChapter.launchedOn,
      status: ministryChapter.status,
      memberCount: count(ministryMembership.membershipId),
    })
    .from(ministryChapter)
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    .leftJoin(
      ministryMembership,
      and(
        eq(ministryMembership.chapterId, ministryChapter.chapterId),
        isNull(ministryMembership.endedAt)
      )
    )
    .where(eq(ministryChapter.ministryId, id))
    .groupBy(
      ministryChapter.chapterId,
      branch.name,
      ministryChapter.branchId,
      ministryChapter.launchedOn,
      ministryChapter.status
    )
    .orderBy(branch.name);

  return { ...row, chapters };
}

export async function createChapter(
  data: CreateChapterInput
): Promise<{ chapterId: number } | { error: string }> {
  const parsed = createChapterSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [row] = await db
    .insert(ministryChapter)
    .values({
      ministryId: parsed.data.ministryId,
      branchId: parsed.data.branchId,
      launchedOn: parsed.data.launchedOn ?? null,
      status: "ACTIVE",
    })
    .returning({ chapterId: ministryChapter.chapterId });

  revalidatePath(`/ministries/${parsed.data.ministryId}`);
  return { chapterId: row.chapterId };
}

export async function updateChapterStatus(
  data: UpdateChapterStatusInput
): Promise<{ success: true } | { error: string }> {
  const parsed = updateChapterStatusSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [existing] = await db
    .select({ ministryId: ministryChapter.ministryId })
    .from(ministryChapter)
    .where(eq(ministryChapter.chapterId, parsed.data.chapterId))
    .limit(1);

  if (!existing) return { error: "Chapter not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db
    .update(ministryChapter)
    .set({ status: parsed.data.status as any })
    .where(eq(ministryChapter.chapterId, parsed.data.chapterId));

  revalidatePath(`/ministries/${existing.ministryId}`);
  revalidatePath(`/ministries/${existing.ministryId}/chapters/${parsed.data.chapterId}`);
  return { success: true };
}

export async function getChapter(chapterId: number) {
  const [row] = await db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryId: ministryChapter.ministryId,
      ministryName: ministry.name,
      branchName: branch.name,
      launchedOn: ministryChapter.launchedOn,
      status: ministryChapter.status,
    })
    .from(ministryChapter)
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    .where(eq(ministryChapter.chapterId, chapterId))
    .limit(1);

  if (!row) return null;

  const members = await db
    .select({
      membershipId: ministryMembership.membershipId,
      memberId: ministryMembership.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      joinedAt: ministryMembership.joinedAt,
      endedAt: ministryMembership.endedAt,
      isLeader: ministryMembership.isLeader,
      leaderRole: ministryMembership.leaderRole,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(ministryMembership.chapterId, chapterId))
    .orderBy(desc(ministryMembership.joinedAt));

  return { ...row, members };
}

export async function addMember(
  data: AddMemberInput
): Promise<{ membershipId: number } | { error: string }> {
  const parsed = addMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [row] = await db
    .insert(ministryMembership)
    .values({
      chapterId: parsed.data.chapterId,
      memberId: parsed.data.memberId,
      joinedAt: new Date(parsed.data.joinedAt),
      isLeader: parsed.data.isLeader,
      leaderRole: (parsed.data.leaderRole as any) ?? null,
    })
    .returning({ membershipId: ministryMembership.membershipId });

  const [chapter] = await db
    .select({ ministryId: ministryChapter.ministryId })
    .from(ministryChapter)
    .where(eq(ministryChapter.chapterId, parsed.data.chapterId))
    .limit(1);

  revalidatePath(`/ministries/${chapter?.ministryId}/chapters/${parsed.data.chapterId}`);
  return { membershipId: row.membershipId };
}

export async function removeMember(
  data: RemoveMemberInput
): Promise<{ success: true } | { error: string }> {
  const parsed = removeMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [existing] = await db
    .select({ chapterId: ministryMembership.chapterId })
    .from(ministryMembership)
    .where(eq(ministryMembership.membershipId, parsed.data.membershipId))
    .limit(1);

  if (!existing) return { error: "Membership not found" };

  await db
    .update(ministryMembership)
    .set({
      endedAt: new Date(),
      endedReason: parsed.data.endedReason ?? null,
    })
    .where(eq(ministryMembership.membershipId, parsed.data.membershipId));

  const [chapter] = await db
    .select({ ministryId: ministryChapter.ministryId })
    .from(ministryChapter)
    .where(eq(ministryChapter.chapterId, existing.chapterId))
    .limit(1);

  revalidatePath(`/ministries/${chapter?.ministryId}/chapters/${existing.chapterId}`);
  return { success: true };
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
git commit -m "feat(ministries): add server actions (list, get, createChapter, addMember, removeMember)"
```

---

## Task 3 — Ministry List + Nav Link

**Files:**
- Create: `app/src/app/(admin)/ministries/page.tsx`
- Modify: `app/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Create ministry list page**

Create `app/src/app/(admin)/ministries/page.tsx`:

```tsx
import Link from "next/link";
import { listMinistries } from "@/actions/ministries";

export const dynamic = "force-dynamic";

export default async function MinistriesPage() {
  const ministries = await listMinistries();

  // Group by network
  const byNetwork = ministries.reduce<Record<string, typeof ministries>>((acc, m) => {
    const key = m.networkName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>
      </div>

      {Object.entries(byNetwork).map(([networkName, items]) => (
        <section key={networkName} className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{networkName}</h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.map((m) => (
              <Link
                key={m.ministryId}
                href={`/ministries/${m.ministryId}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  {m.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  )}
                  {m.targetDemographic && (
                    <p className="text-xs text-gray-400">{m.targetDemographic}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <span className="text-sm text-gray-500">{m.chapterCount} chapter{m.chapterCount !== 1 ? "s" : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {ministries.length === 0 && (
        <p className="text-sm text-gray-500">No ministries found.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Ministries nav link**

Open `app/src/app/(admin)/layout.tsx`. Find the existing nav links (look for Announcements or Programs). Add after the last nav item:

```tsx
<Link href="/ministries" className={...}>Ministries</Link>
```

Match the exact className pattern already used in the file for other nav links.

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/\(admin\)/ministries/page.tsx app/src/app/\(admin\)/layout.tsx
git commit -m "feat(ministries): add ministry list page and nav link"
```

---

## Task 4 — Ministry Detail + Add Chapter Form

**Files:**
- Create: `app/src/app/(admin)/ministries/[id]/page.tsx`
- Create: `app/src/app/(admin)/ministries/[id]/chapters/new/page.tsx`

- [ ] **Step 1: Create ministry detail page**

Create `app/src/app/(admin)/ministries/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getMinistry } from "@/actions/ministries";

export const dynamic = "force-dynamic";

const statusColors = {
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default async function MinistryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const ministry = await getMinistry(id);
  if (!ministry) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">{ministry.networkName}</p>
          <h1 className="text-2xl font-bold text-gray-900">{ministry.name}</h1>
          {ministry.description && (
            <p className="text-sm text-gray-500 mt-1">{ministry.description}</p>
          )}
        </div>
        <Link
          href={`/ministries/${id}/chapters/new`}
          className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add chapter
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Chapters ({ministry.chapters.length})
        </h2>
        {ministry.chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No chapters yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {ministry.chapters.map((ch) => (
              <Link
                key={ch.chapterId}
                href={`/ministries/${id}/chapters/${ch.chapterId}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{ch.branchName}</p>
                  {ch.launchedOn && (
                    <p className="text-xs text-gray-400">Launched {ch.launchedOn}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-sm text-gray-500">{ch.memberCount} member{ch.memberCount !== 1 ? "s" : ""}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ch.status]}`}>
                    {ch.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create add chapter form**

Create `app/src/app/(admin)/ministries/[id]/chapters/new/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { ministry } from "@/schema/ministries";
import { eq } from "drizzle-orm";
import { createChapter } from "@/actions/ministries";

export const dynamic = "force-dynamic";

export default async function NewChapterPage({
  params,
}: {
  params: { id: string };
}) {
  const ministryId = Number(params.id);
  if (!Number.isInteger(ministryId) || ministryId <= 0) notFound();

  const [min] = await db
    .select({ name: ministry.name })
    .from(ministry)
    .where(eq(ministry.ministryId, ministryId))
    .limit(1);
  if (!min) notFound();

  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  async function handleCreate(fd: FormData) {
    "use server";
    const branchId = Number(fd.get("branchId"));
    const launchedOn = (fd.get("launchedOn") as string) || undefined;
    const result = await createChapter({ ministryId, branchId, launchedOn });
    if ("chapterId" in result) {
      redirect(`/ministries/${ministryId}/chapters/${result.chapterId}`);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          <a href={`/ministries/${ministryId}`} className="hover:underline">{min.name}</a>
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Add chapter</h1>
      </div>

      <form action={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            name="branchId"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Launch date (optional)</label>
          <input
            type="date"
            name="launchedOn"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create chapter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/\(admin\)/ministries/\[id\]/page.tsx app/src/app/\(admin\)/ministries/\[id\]/chapters/new/page.tsx
git commit -m "feat(ministries): add ministry detail page and add-chapter form"
```

---

## Task 5 — Chapter Detail Page

**Files:**
- Create: `app/src/app/(admin)/ministries/[id]/chapters/[chapterId]/page.tsx`

- [ ] **Step 1: Create chapter detail page**

Create `app/src/app/(admin)/ministries/[id]/chapters/[chapterId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { eq, isNull } from "drizzle-orm";
import { getChapter, updateChapterStatus, addMember, removeMember } from "@/actions/ministries";

export const dynamic = "force-dynamic";

const statusColors = {
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default async function ChapterDetailPage({
  params,
}: {
  params: { id: string; chapterId: string };
}) {
  const ministryId = Number(params.id);
  const chapterId = Number(params.chapterId);
  if (!Number.isInteger(ministryId) || ministryId <= 0) notFound();
  if (!Number.isInteger(chapterId) || chapterId <= 0) notFound();

  const chapter = await getChapter(chapterId);
  if (!chapter) notFound();

  const activeMembers = chapter.members.filter((m) => !m.endedAt);

  const availableMembers = await db
    .select({
      memberId: member.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .where(isNull(member.deletedAt))
    .orderBy(person.lastName, person.firstName);

  async function handleStatusChange(fd: FormData) {
    "use server";
    const status = fd.get("status") as "ACTIVE" | "PAUSED" | "CLOSED";
    await updateChapterStatus({ chapterId, status });
  }

  async function handleAddMember(fd: FormData) {
    "use server";
    const memberId = Number(fd.get("memberId"));
    const joinedAt = new Date(fd.get("joinedAt") as string).toISOString();
    const isLeader = fd.get("isLeader") === "true";
    const leaderRole = (fd.get("leaderRole") as string) || undefined;
    await addMember({
      chapterId,
      memberId,
      joinedAt,
      isLeader,
      leaderRole: leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR" | undefined,
    });
  }

  async function handleRemoveMember(fd: FormData) {
    "use server";
    const membershipId = Number(fd.get("membershipId"));
    const endedReason = (fd.get("endedReason") as string) || undefined;
    await removeMember({ membershipId, endedReason });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            <a href={`/ministries/${ministryId}`} className="hover:underline">{chapter.ministryName}</a>
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{chapter.branchName} Chapter</h1>
          {chapter.launchedOn && (
            <p className="text-sm text-gray-400">Launched {chapter.launchedOn}</p>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[chapter.status]}`}>
          {chapter.status}
        </span>
      </div>

      {/* Status change */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Update status</h2>
        <form action={handleStatusChange} className="flex gap-2 flex-wrap">
          {(["ACTIVE", "PAUSED", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              disabled={chapter.status === s}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Set {s}
            </button>
          ))}
        </form>
      </section>

      {/* Active members */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Members ({activeMembers.length})
        </h2>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-gray-500">No active members.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activeMembers.map((m) => (
              <li key={m.membershipId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                  {m.isLeader && m.leaderRole && (
                    <p className="text-xs text-blue-600">{m.leaderRole.replace(/_/g, " ")}</p>
                  )}
                  <p className="text-xs text-gray-400">Joined {new Date(m.joinedAt).toLocaleDateString("en-PH")}</p>
                </div>
                <form action={handleRemoveMember}>
                  <input type="hidden" name="membershipId" value={m.membershipId} />
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add member */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Add member</h2>
        <form action={handleAddMember} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Member</label>
            <select
              name="memberId"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select member…</option>
              {availableMembers.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.lastName}, {m.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Joined date</label>
            <input
              type="date"
              name="joinedAt"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="isLeader" value="true" />
              Leader
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Leader role (if leader)</label>
            <select
              name="leaderRole"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              <option value="HEAD">Head</option>
              <option value="ASSISTANT_HEAD">Assistant Head</option>
              <option value="COORDINATOR">Coordinator</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add member
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
git add "app/src/app/(admin)/ministries/[id]/chapters/[chapterId]/page.tsx"
git commit -m "feat(ministries): add chapter detail page with member management"
```

---

## Task 6 — E2E Tests

**Files:**
- Create: `app/tests/e2e/ministries.spec.ts`

- [ ] **Step 1: Create E2E tests**

Create `app/tests/e2e/ministries.spec.ts`:

```typescript
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

test.describe("Ministries", () => {
  test("staff can view ministry list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await expect(page.getByRole("heading", { name: "Ministries" })).toBeVisible();
    // Seeded ministries should appear
    await expect(page.getByText("Kingdom Kids")).toBeVisible();
  });

  test("staff can view ministry detail", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await page.getByText("Kingdom Kids").click();
    await expect(page.getByRole("heading", { name: "Kingdom Kids" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add chapter" })).toBeVisible();
  });

  test("staff can create a chapter", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await page.getByText("Kingdom Kids").click();
    await page.getByRole("link", { name: "Add chapter" }).click();
    await expect(page.getByRole("heading", { name: "Add chapter" })).toBeVisible();
    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.getByRole("button", { name: "Create chapter" }).click();
    // Redirects to chapter detail
    await expect(page).toHaveURL(/\/ministries\/\d+\/chapters\/\d+/);
  });

  test("chapter detail shows member management UI", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await page.getByText("Kingdom Kids").click();
    await page.getByRole("link", { name: "Add chapter" }).click();
    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.getByRole("button", { name: "Create chapter" }).click();
    await expect(page.getByRole("heading", { name: /Chapter/ })).toBeVisible();
    await expect(page.getByText("Add member")).toBeVisible();
  });

  test("staff can update chapter status", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await page.getByText("Kingdom Kids").click();
    await page.getByRole("link", { name: "Add chapter" }).click();
    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.getByRole("button", { name: "Create chapter" }).click();
    await page.getByRole("button", { name: "Set PAUSED" }).click();
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
cd app && npx playwright test tests/e2e/ministries.spec.ts --reporter=list
```

Expected: 5/5 passing.

- [ ] **Step 3: Run full unit suite**

```bash
cd app && npx vitest run
```

Expected: 238 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/ministries.spec.ts
git commit -m "test(e2e): add ministries E2E tests"
```

---

## No DB Migration Needed

Schema V029–V032 already exists. Seed data pre-populates networks and ministries.

## Summary

| Task | Files | Tests |
|------|-------|-------|
| 1 | `validations/ministries.ts` | 22 unit tests |
| 2 | `actions/ministries.ts` | — |
| 3 | `ministries/page.tsx`, `layout.tsx` | — |
| 4 | `ministries/[id]/page.tsx`, `chapters/new/page.tsx` | — |
| 5 | `chapters/[chapterId]/page.tsx` | — |
| 6 | `ministries.spec.ts` | 5 E2E tests |
