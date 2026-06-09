# Plan 9: Scholarships Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Scholarships admin module for tracking scholarship programs and individual awards to JLY members.

**Architecture:** Two DB tables already exist in `missions` schema (V046): `scholar_program` and `scholarship_award`. Add Drizzle table definitions to the existing `app/src/schema/missions.ts`, add validation + actions, then add 4 admin pages under `/missions/scholarships/`. No new migrations needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM (`missions` schema), Zod, Vitest, Playwright.

---

## DB Schema Reference

Read `db/migrations/V046__missions_scholar_award.sql` before implementing.

Key columns:
- `scholar_program`: program_id, name, starts_on (date), ends_on (date), description (text), status (enum: PLANNING/ACTIVE/COMPLETED/CANCELLED)
- `scholarship_award`: award_id, program_id (FK), member_id (FK → membership.member), awarded_at (timestamptz), term (text), amount (numeric), school_name (text), sponsor_member_id (FK → membership.member, nullable), status (enum: AWARDED/ACTIVE/COMPLETED/REVOKED), notes (text)

Key constraints:
- `scholarship_award.member_id` references `membership.member(member_id)` — NOT `core.person`
- `scholarship_award.sponsor_member_id` is nullable

---

## File Map

| Action | Path |
|--------|------|
| Modify | `app/src/schema/missions.ts` |
| Create | `app/src/lib/validations/scholarship.ts` |
| Create | `app/tests/unit/scholarship.test.ts` |
| Create | `app/src/actions/scholarship.ts` |
| Modify | `app/src/app/(admin)/layout.tsx` |
| Create | `app/src/app/(admin)/missions/scholarships/page.tsx` |
| Create | `app/src/app/(admin)/missions/scholarships/new/page.tsx` |
| Create | `app/src/app/(admin)/missions/scholarships/[id]/page.tsx` |
| Create | `app/src/app/(admin)/missions/scholarships/[id]/awards/new/page.tsx` |
| Create | `app/tests/e2e/scholarships.spec.ts` |

**Total: 10 changes (7 new files + 3 modified). No migrations.**

---

## Task 1: Add Scholar Tables to missions.ts

**Files:**
- Modify: `app/src/schema/missions.ts`

Add two new enums and two new tables to the END of the existing file. Do not change existing content.

- [ ] **Step 1: Add scholar tables**

Append to `app/src/schema/missions.ts` after the last line:

```ts
// --- Scholar / Scholarship tables (V046) ---

import { numeric } from "drizzle-orm/pg-core";

export const programStatusEnum = missionsSchema.enum("program_status", [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const awardStatusEnum = missionsSchema.enum("award_status", [
  "AWARDED",
  "ACTIVE",
  "COMPLETED",
  "REVOKED",
]);

export const scholarProgram = missionsSchema.table("scholar_program", {
  programId: bigserial("program_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  description: text("description"),
  status: programStatusEnum("status").notNull().default("PLANNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const scholarshipAward = missionsSchema.table("scholarship_award", {
  awardId: bigserial("award_id", { mode: "number" }).primaryKey(),
  programId: bigint("program_id", { mode: "number" }).notNull().references(() => scholarProgram.programId),
  memberId: bigint("member_id", { mode: "number" }).notNull().references(() => member.memberId),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  term: text("term"),
  amount: numeric("amount"),
  schoolName: text("school_name"),
  sponsorMemberId: bigint("sponsor_member_id", { mode: "number" }).references(() => member.memberId),
  status: awardStatusEnum("status").notNull().default("AWARDED"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

**Important:** `numeric` is not yet imported in missions.ts — add it to the existing import at the top of the file. The import block currently is:
```ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  pgSchema,
} from "drizzle-orm/pg-core";
```

Change it to:
```ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  numeric,
  pgSchema,
} from "drizzle-orm/pg-core";
```

Remove the inline `import { numeric }` comment — just add `numeric` to the main import block.

The final appended code block (after the import fix) should be:

```ts
// --- Scholar / Scholarship tables (V046) ---

export const programStatusEnum = missionsSchema.enum("program_status", [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const awardStatusEnum = missionsSchema.enum("award_status", [
  "AWARDED",
  "ACTIVE",
  "COMPLETED",
  "REVOKED",
]);

export const scholarProgram = missionsSchema.table("scholar_program", {
  programId: bigserial("program_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  description: text("description"),
  status: programStatusEnum("status").notNull().default("PLANNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const scholarshipAward = missionsSchema.table("scholarship_award", {
  awardId: bigserial("award_id", { mode: "number" }).primaryKey(),
  programId: bigint("program_id", { mode: "number" }).notNull().references(() => scholarProgram.programId),
  memberId: bigint("member_id", { mode: "number" }).notNull().references(() => member.memberId),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  term: text("term"),
  amount: numeric("amount"),
  schoolName: text("school_name"),
  sponsorMemberId: bigint("sponsor_member_id", { mode: "number" }).references(() => member.memberId),
  status: awardStatusEnum("status").notNull().default("AWARDED"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/schema/missions.ts
git commit -m "feat(schema): add scholar_program and scholarship_award tables to missions schema"
```

---

## Task 2: Scholarship Validation Schemas + Unit Tests (TDD)

**Files:**
- Create: `app/src/lib/validations/scholarship.ts`
- Create: `app/tests/unit/scholarship.test.ts`

**Pattern:** Follow `app/src/lib/validations/bac.ts`.

- [ ] **Step 1: Write failing unit tests first**

Create `app/tests/unit/scholarship.test.ts`:

```ts
// app/tests/unit/scholarship.test.ts
import { describe, it, expect } from "vitest";
import {
  createScholarProgramSchema,
  updateScholarProgramSchema,
  createAwardSchema,
} from "@/lib/validations/scholarship";

describe("createScholarProgramSchema", () => {
  it("accepts valid input", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "JLY Scholarship 2026",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "JLY Scholarship 2026",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      description: "Annual scholarship",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createScholarProgramSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects invalid status", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "Test",
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid startsOn date", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "Test",
      startsOn: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateScholarProgramSchema", () => {
  it("accepts partial update", () => {
    const result = updateScholarProgramSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateScholarProgramSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createAwardSchema", () => {
  it("accepts minimal input", () => {
    const result = createAwardSchema.safeParse({ memberId: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = createAwardSchema.safeParse({
      memberId: 1,
      term: "AY 2026-2027",
      amount: "5000.00",
      schoolName: "UP Manila",
      sponsorMemberId: 2,
      status: "ACTIVE",
      notes: "Full scholarship",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing memberId", () => {
    const result = createAwardSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("memberId");
  });

  it("rejects invalid status", () => {
    const result = createAwardSchema.safeParse({ memberId: 1, status: "PENDING" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npx vitest run tests/unit/scholarship.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create validation file**

```ts
// app/src/lib/validations/scholarship.ts
import { z } from "zod";

const programStatusEnum = z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]);
const awardStatusEnum = z.enum(["AWARDED", "ACTIVE", "COMPLETED", "REVOKED"]);

export const createScholarProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startsOn: z.string().date("Invalid date").optional(),
  endsOn: z.string().date("Invalid date").optional(),
  description: z.string().optional(),
  status: programStatusEnum.optional(),
});

export const updateScholarProgramSchema = createScholarProgramSchema.partial();

export const createAwardSchema = z.object({
  memberId: z.number().int().positive("Member is required"),
  term: z.string().optional(),
  amount: z.string().optional(),
  schoolName: z.string().optional(),
  sponsorMemberId: z.number().int().positive().optional(),
  status: awardStatusEnum.optional(),
  notes: z.string().optional(),
});

export type CreateScholarProgramInput = z.infer<typeof createScholarProgramSchema>;
export type UpdateScholarProgramInput = z.infer<typeof updateScholarProgramSchema>;
export type CreateAwardInput = z.infer<typeof createAwardSchema>;
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd app && npx vitest run tests/unit/scholarship.test.ts
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/scholarship.ts app/tests/unit/scholarship.test.ts
git commit -m "feat(validation): add scholarship validation schemas with unit tests"
```

---

## Task 3: Scholarship Server Actions

**Files:**
- Create: `app/src/actions/scholarship.ts`

**Pattern:** Follow `app/src/actions/bac.ts`. "use server", Zod parse, `as any` for bigint FKs, `revalidatePath`, `redirect`. Return `{ errors }` for validation failures, `{ error }` for DB errors.

- [ ] **Step 1: Create action file**

```ts
// app/src/actions/scholarship.ts
"use server";

import { db } from "@/lib/db";
import { scholarProgram, scholarshipAward } from "@/schema/missions";
import {
  createScholarProgramSchema,
  updateScholarProgramSchema,
  createAwardSchema,
} from "@/lib/validations/scholarship";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createScholarProgram(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = createScholarProgramSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [p] = await db.insert(scholarProgram).values({
    name: parsed.data.name,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    description: parsed.data.description,
    status: parsed.data.status ?? "PLANNING",
  }).returning({ programId: scholarProgram.programId });

  revalidatePath("/missions/scholarships");
  redirect(`/missions/scholarships/${p.programId}`);
}

export async function updateScholarProgram(programId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = updateScholarProgramSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.update(scholarProgram)
    .set({
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.startsOn !== undefined && { startsOn: parsed.data.startsOn }),
      ...(parsed.data.endsOn !== undefined && { endsOn: parsed.data.endsOn }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.status && { status: parsed.data.status }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  revalidatePath(`/missions/scholarships/${programId}`);
  redirect(`/missions/scholarships/${programId}`);
}

export async function createAward(programId: number, formData: FormData) {
  const raw = {
    memberId: Number(formData.get("memberId")),
    term: (formData.get("term") as string) || undefined,
    amount: (formData.get("amount") as string) || undefined,
    schoolName: (formData.get("schoolName") as string) || undefined,
    sponsorMemberId: formData.get("sponsorMemberId")
      ? Number(formData.get("sponsorMemberId"))
      : undefined,
    status: (formData.get("status") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = createAwardSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.insert(scholarshipAward).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    programId: programId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memberId: parsed.data.memberId as any,
    term: parsed.data.term,
    amount: parsed.data.amount,
    schoolName: parsed.data.schoolName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sponsorMemberId: parsed.data.sponsorMemberId as any,
    status: parsed.data.status ?? "AWARDED",
    notes: parsed.data.notes,
  });

  revalidatePath(`/missions/scholarships/${programId}`);
  redirect(`/missions/scholarships/${programId}`);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/scholarship.ts
git commit -m "feat(actions): add scholarship server actions"
```

---

## Task 4: Nav Update + Scholarship Pages

**Files:**
- Modify: `app/src/app/(admin)/layout.tsx`
- Create: `app/src/app/(admin)/missions/scholarships/page.tsx`
- Create: `app/src/app/(admin)/missions/scholarships/new/page.tsx`
- Create: `app/src/app/(admin)/missions/scholarships/[id]/page.tsx`
- Create: `app/src/app/(admin)/missions/scholarships/[id]/awards/new/page.tsx`

**Pattern:** Follow `app/src/app/(admin)/programs/heartlink/` pages exactly — same Tailwind styling, same `force-dynamic`, same `notFound()`.

- [ ] **Step 1: Add Missions link to admin nav**

In `app/src/app/(admin)/layout.tsx`, add after the Education `<Link>` (line 46):

```tsx
<Link
  href="/missions/scholarships"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Missions
</Link>
```

- [ ] **Step 2: Create scholarships list page**

```tsx
// app/src/app/(admin)/missions/scholarships/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { scholarProgram } from "@/schema/missions";
import { desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type ProgramStatus = "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  const statusValues: ProgramStatus[] =
    statusFilter === "all"
      ? ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]
      : statusFilter === "completed"
      ? ["COMPLETED", "CANCELLED"]
      : ["PLANNING", "ACTIVE"];

  const programs = await db
    .select({
      programId: scholarProgram.programId,
      name: scholarProgram.name,
      status: scholarProgram.status,
      startsOn: scholarProgram.startsOn,
      endsOn: scholarProgram.endsOn,
      description: scholarProgram.description,
    })
    .from(scholarProgram)
    .where(inArray(scholarProgram.status, statusValues))
    .orderBy(desc(scholarProgram.programId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Scholarship Programs</h1>
        <Link
          href="/missions/scholarships/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New program
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "completed", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/missions/scholarships?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-gray-500">No scholarship programs found.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <Link
              key={p.programId}
              href={`/missions/scholarships/${p.programId}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.description && (
                    <p className="text-sm text-gray-500">{p.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-gray-400">
                    {p.startsOn && <span>Starts {p.startsOn}</span>}
                    {p.endsOn && <span>Ends {p.endsOn}</span>}
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase">{p.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create new program page**

```tsx
// app/src/app/(admin)/missions/scholarships/new/page.tsx
import Link from "next/link";
import { createScholarProgram } from "@/actions/scholarship";

export default function NewScholarProgramPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/missions/scholarships" className="text-sm text-gray-500 hover:text-gray-900">
          ← Scholarship Programs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New scholarship program</h1>
      </div>
      <form action={(fd) => void createScholarProgram(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Program name <span className="text-red-500">*</span>
          </label>
          <input name="name" type="text" required placeholder="JLY Scholarship 2026"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts on</label>
            <input name="startsOn" type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends on</label>
            <input name="endsOn" type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create program
          </button>
          <Link href="/missions/scholarships"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create program detail page**

```tsx
// app/src/app/(admin)/missions/scholarships/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { scholarProgram, scholarshipAward } from "@/schema/missions";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { eq, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ScholarProgramDetailPage({ params }: { params: { id: string } }) {
  const programId = Number(params.id);

  const [program] = await db
    .select()
    .from(scholarProgram)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  if (!program) notFound();

  const [{ awardCount }] = await db
    .select({ awardCount: count() })
    .from(scholarshipAward)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarshipAward.programId, programId as any));

  const awards = await db
    .select({
      awardId: scholarshipAward.awardId,
      term: scholarshipAward.term,
      amount: scholarshipAward.amount,
      schoolName: scholarshipAward.schoolName,
      status: scholarshipAward.status,
      awardedAt: scholarshipAward.awardedAt,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(scholarshipAward)
    .innerJoin(member, eq(scholarshipAward.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarshipAward.programId, programId as any))
    .orderBy(scholarshipAward.awardedAt);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/missions/scholarships" className="text-sm text-gray-500 hover:text-gray-900">
            ← Scholarship Programs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{program.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {program.status}
            {program.startsOn ? ` · ${program.startsOn}` : ""}
            {program.endsOn ? ` – ${program.endsOn}` : ""}
          </p>
          {program.description && (
            <p className="text-sm text-gray-600 mt-2">{program.description}</p>
          )}
        </div>
        <Link
          href={`/missions/scholarships/${programId}/awards/new`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add award
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{awardCount}</p>
          <p className="text-xs text-gray-500">Awards</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Awards ({awards.length})</h2>
        {awards.length === 0 ? (
          <p className="text-sm text-gray-500">No awards yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Awardee</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">School</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Term</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {awards.map((a) => (
                  <tr key={a.awardId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.firstName} {a.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.schoolName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.term ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.amount ? `₱${a.amount}` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create add award page**

```tsx
// app/src/app/(admin)/missions/scholarships/[id]/awards/new/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { scholarProgram } from "@/schema/missions";
import { eq } from "drizzle-orm";
import { createAward } from "@/actions/scholarship";

export default async function NewAwardPage({ params }: { params: { id: string } }) {
  const programId = Number(params.id);

  const [program] = await db
    .select({ programId: scholarProgram.programId, name: scholarProgram.name })
    .from(scholarProgram)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  if (!program) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/missions/scholarships/${programId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {program.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add award</h1>
      </div>
      <form action={(fd) => void createAward(programId, fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member ID <span className="text-red-500">*</span>
          </label>
          <input name="memberId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School name</label>
          <input name="schoolName" type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <input name="term" type="text" placeholder="AY 2026-2027"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
            <input name="amount" type="number" step="0.01" min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor Member ID</label>
          <input name="sponsorMemberId" type="number" min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="AWARDED">Awarded</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add award
          </button>
          <Link href={`/missions/scholarships/${programId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/(admin)/layout.tsx "app/src/app/(admin)/missions"
git commit -m "feat(scholarships): add scholarship programs and awards pages"
```

---

## Task 5: E2E Tests

**Files:**
- Create: `app/tests/e2e/scholarships.spec.ts`

**Pattern:** Follow `app/tests/e2e/programs.spec.ts`.

- [ ] **Step 1: Create E2E test file**

```ts
// app/tests/e2e/scholarships.spec.ts
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

test.describe("Scholarship programs", () => {
  test("Missions link visible in nav", async ({ page }) => {
    await staffLogin(page);
    await expect(page.getByRole("link", { name: "Missions" })).toBeVisible();
  });

  test("Scholarship programs page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await expect(page.getByRole("heading", { name: "Scholarship Programs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New program" })).toBeVisible();
  });

  test("New program page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships/new");
    await expect(page.getByRole("heading", { name: "New scholarship program" })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="status"]')).toBeVisible();
  });

  test("staff can create a scholarship program", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships/new");

    await page.fill('input[name="name"]', "E2E Test Scholarship 2026");
    await page.selectOption('select[name="status"]', "ACTIVE");
    await page.getByRole("button", { name: "Create program" }).click();

    await expect(page).toHaveURL(/\/missions\/scholarships\/\d+/);
    await expect(page.getByText("E2E Test Scholarship 2026")).toBeVisible();
  });

  test("created program appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await expect(page.getByText("E2E Test Scholarship 2026")).toBeVisible();
  });

  test("program detail shows Add award button", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await page.getByText("E2E Test Scholarship 2026").click();
    await expect(page.getByRole("link", { name: "Add award" })).toBeVisible();
  });

  test("Add award page loads with member ID field", async ({ page }) => {
    await staffLogin(page);
    // find the program we created
    await page.goto("/missions/scholarships");
    await page.getByText("E2E Test Scholarship 2026").click();
    await page.getByRole("link", { name: "Add award" }).click();
    await expect(page.getByRole("heading", { name: "Add award" })).toBeVisible();
    await expect(page.locator('input[name="memberId"]')).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit (do NOT run Playwright — requires live DB)**

```bash
git add app/tests/e2e/scholarships.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for scholarship programs"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Add `scholarProgram` + `scholarshipAward` Drizzle tables to `missions.ts` | Task 1 |
| Add `numeric` to pg-core imports in missions.ts | Task 1 |
| Zod schemas: createScholarProgram, updateScholarProgram, createAward + types | Task 2 |
| Unit tests for all 3 schemas | Task 2 |
| Server actions: createScholarProgram, updateScholarProgram, createAward | Task 3 |
| Nav: Missions link → /missions/scholarships | Task 4 Step 1 |
| Page: scholarship list with status filter | Task 4 Step 2 |
| Page: new program form | Task 4 Step 3 |
| Page: program detail with awards table | Task 4 Step 4 |
| Page: add award form | Task 4 Step 5 |
| E2E: nav visible, list/create/detail flows | Task 5 |

### Placeholder scan

No TBD/TODO/placeholder text present. All code steps contain complete implementations.

### Type consistency

- `scholarProgram.programId` used consistently in all pages and actions
- `scholarshipAward.memberId` references `member.memberId` (NOT `person.personId`) — consistent with DB migration
- Action names match page imports: `createScholarProgram`, `updateScholarProgram`, `createAward`
- Schema exports: `scholarProgram`, `scholarshipAward`, `programStatusEnum`, `awardStatusEnum` — consistent throughout
- `updateScholarProgram` exported from actions but not wired to a page — intentional, kept for future use (edit page not in scope, status can be set on create)
