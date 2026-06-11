# Attendance Audit Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly attendance-trend visuals to the admin `/events/attendance` page and a personal "My attendance" section to `/me`.

**Architecture:** All server components, zero new dependencies, no DB migrations. A pure aggregation helper (`attendance-trends.ts`) buckets `attendance.attendance_summary` rows by week; a server-rendered SVG bar-chart component visualizes them. The member view queries `attendance.check_in` directly by the member's own `person_id`.

**Tech Stack:** Next.js 14 App Router (server components), Drizzle ORM + raw SQL via `db.execute`, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-attendance-audit-dashboard-design.md`

**Working directory:** all commands run from `app/` unless noted. Git commands run from repo root.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/src/lib/attendance-trends.ts` | NEW — pure functions: bucket summary rows by week, compute range totals |
| `app/tests/unit/attendance-trends.test.ts` | NEW — unit tests for the helper |
| `app/src/components/trend-chart.tsx` | NEW — server component rendering SVG grouped bar chart |
| `app/src/app/(admin)/events/attendance/page.tsx` | MODIFY — stat cards + trend section above existing table |
| `app/src/app/me/page.tsx` | MODIFY — "My attendance" card after Journey section |

---

### Task 1: Weekly aggregation helper (TDD)

**Files:**
- Create: `app/src/lib/attendance-trends.ts`
- Test: `app/tests/unit/attendance-trends.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/attendance-trends.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  aggregateWeekly,
  trendTotals,
  type WeeklySummaryInput,
} from "@/lib/attendance-trends";

describe("aggregateWeekly", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateWeekly([])).toEqual([]);
  });

  it("passes through a single week", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: 50, unique_persons: 40, ftv_count: 3 },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 50, uniquePersons: 40, ftv: 3 },
    ]);
  });

  it("sums multiple events in the same week", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: 50, unique_persons: 40, ftv_count: 3 },
      { week_start: "2026-06-01", total_check_ins: 20, unique_persons: 18, ftv_count: 1 },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 70, uniquePersons: 58, ftv: 4 },
    ]);
  });

  it("sorts weeks ascending regardless of input order", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-08", total_check_ins: 10, unique_persons: 10, ftv_count: 0 },
      { week_start: "2026-06-01", total_check_ins: 5, unique_persons: 5, ftv_count: 0 },
    ];
    expect(aggregateWeekly(rows).map((b) => b.week)).toEqual([
      "2026-06-01",
      "2026-06-08",
    ]);
  });

  it("treats null counts as zero", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: null, unique_persons: null, ftv_count: null },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 0, uniquePersons: 0, ftv: 0 },
    ]);
  });
});

describe("trendTotals", () => {
  it("returns zeros for no buckets (no divide-by-zero)", () => {
    expect(trendTotals([])).toEqual({ totalCheckIns: 0, totalFtv: 0, avgPerWeek: 0 });
  });

  it("computes totals and rounded average", () => {
    const buckets = [
      { week: "2026-06-01", checkIns: 70, uniquePersons: 58, ftv: 4 },
      { week: "2026-06-08", checkIns: 31, uniquePersons: 30, ftv: 1 },
    ];
    expect(trendTotals(buckets)).toEqual({
      totalCheckIns: 101,
      totalFtv: 5,
      avgPerWeek: 51, // round(101/2)
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run tests/unit/attendance-trends.test.ts`
Expected: FAIL — cannot resolve `@/lib/attendance-trends`.

- [ ] **Step 3: Write minimal implementation**

Create `app/src/lib/attendance-trends.ts`:

```ts
// app/src/lib/attendance-trends.ts
// Pure aggregation helpers for the attendance trend dashboard.

export type WeeklySummaryInput = {
  week_start: string;
  total_check_ins: number | null;
  unique_persons: number | null;
  ftv_count: number | null;
};

export type WeeklyBucket = {
  week: string;
  checkIns: number;
  uniquePersons: number;
  ftv: number;
};

export function aggregateWeekly(rows: WeeklySummaryInput[]): WeeklyBucket[] {
  const byWeek = new Map<string, WeeklyBucket>();
  for (const row of rows) {
    const bucket = byWeek.get(row.week_start) ?? {
      week: row.week_start,
      checkIns: 0,
      uniquePersons: 0,
      ftv: 0,
    };
    bucket.checkIns += Number(row.total_check_ins ?? 0);
    bucket.uniquePersons += Number(row.unique_persons ?? 0);
    bucket.ftv += Number(row.ftv_count ?? 0);
    byWeek.set(row.week_start, bucket);
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

export function trendTotals(buckets: WeeklyBucket[]): {
  totalCheckIns: number;
  totalFtv: number;
  avgPerWeek: number;
} {
  const totalCheckIns = buckets.reduce((sum, b) => sum + b.checkIns, 0);
  const totalFtv = buckets.reduce((sum, b) => sum + b.ftv, 0);
  const avgPerWeek =
    buckets.length === 0 ? 0 : Math.round(totalCheckIns / buckets.length);
  return { totalCheckIns, totalFtv, avgPerWeek };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `app/`): `npx vitest run tests/unit/attendance-trends.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/attendance-trends.ts app/tests/unit/attendance-trends.test.ts
git commit -m "feat(attendance): weekly trend aggregation helper"
```

---

### Task 2: TrendChart SVG component

**Files:**
- Create: `app/src/components/trend-chart.tsx`

No unit test — pure presentational SVG, verified via tsc + page render in Task 3.

- [ ] **Step 1: Create the component**

Create `app/src/components/trend-chart.tsx`:

```tsx
// app/src/components/trend-chart.tsx
// Server-rendered SVG grouped bar chart for weekly attendance trends.
// Blue bar = total check-ins, amber bar = FTV count.
import type { WeeklyBucket } from "@/lib/attendance-trends";

const WIDTH = 800;
const HEIGHT = 220;
const PAD_X = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 28;

export default function TrendChart({ buckets }: { buckets: WeeklyBucket[] }) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((b) => b.checkIns), 1);
  const innerWidth = WIDTH - PAD_X * 2;
  const slot = innerWidth / buckets.length;
  const barWidth = Math.min(28, slot * 0.5);
  const ftvWidth = Math.max(3, barWidth * 0.4);
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  // Show at most ~12 x-axis labels so the year view stays legible.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 12));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Weekly attendance trend"
    >
      {buckets.map((b, i) => {
        const cx = PAD_X + i * slot + slot / 2;
        const barH = (b.checkIns / max) * chartHeight;
        const ftvH = (b.ftv / max) * chartHeight;
        const barY = PAD_TOP + chartHeight - barH;
        const ftvY = PAD_TOP + chartHeight - ftvH;
        return (
          <g key={b.week}>
            <rect
              x={cx - barWidth / 2}
              y={barY}
              width={barWidth}
              height={barH}
              rx={2}
              className="fill-blue-500"
            />
            <rect
              x={cx + barWidth / 2 + 2}
              y={ftvY}
              width={ftvWidth}
              height={ftvH}
              rx={1}
              className="fill-amber-400"
            />
            <text
              x={cx}
              y={barY - 4}
              textAnchor="middle"
              className="fill-gray-600"
              fontSize={10}
            >
              {b.checkIns}
            </text>
            {i % labelEvery === 0 && (
              <text
                x={cx}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize={9}
              >
                {b.week.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx tsc --noEmit`
Expected: clean (component compiles; not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/trend-chart.tsx
git commit -m "feat(attendance): SVG trend chart server component"
```

---

### Task 3: Wire trend section into admin attendance page

**Files:**
- Modify: `app/src/app/(admin)/events/attendance/page.tsx`

The page already fetches `summary: SummaryRow[]` (rows from `attendance.attendance_summary`, filtered by branch/range, LIMIT 200). Reuse those rows for the trend — no second query.

- [ ] **Step 1: Add imports**

At the top of `app/src/app/(admin)/events/attendance/page.tsx`, after the existing imports (line 4), add:

```tsx
import { aggregateWeekly, trendTotals } from "@/lib/attendance-trends";
import TrendChart from "@/components/trend-chart";
```

- [ ] **Step 2: Compute buckets after the summary fetch**

Directly after the line `const summary = (Array.isArray(result) ? ... ) as SummaryRow[];` (currently line 59), add:

```tsx
  const buckets = aggregateWeekly(summary);
  const totals = trendTotals(buckets);
```

(`SummaryRow` is structurally compatible with `WeeklySummaryInput` — same field names, non-null numbers.)

- [ ] **Step 3: Render stat cards + chart above the table**

In the JSX, between the closing `</form>` of the Filters block and the `{/* Table */}` comment, insert:

```tsx
      {/* Weekly trend */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Weekly trend</h2>
        {buckets.length === 0 ? (
          <p className="text-sm text-gray-500">
            No attendance data for the selected filters.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total check-ins", value: totals.totalCheckIns },
                { label: "Avg per week", value: totals.avgPerWeek },
                { label: "First-time visitors", value: totals.totalFtv },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white rounded-lg border border-gray-200 px-5 py-4"
                >
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <TrendChart buckets={buckets} />
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                  Check-ins
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
                  First-time visitors
                </span>
              </div>
            </div>
          </>
        )}
      </div>
```

- [ ] **Step 4: Type-check**

Run (from `app/`): `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Visual check (optional if no local DB running)**

Run (from `app/`, with local DB up and `DATABASE_URL` overridden to localhost — NEVER against Neon): `npm run dev`, open `http://localhost:3000/events/attendance`.
Expected: stat cards + bar chart above the table; switching branch/range filters updates both.

- [ ] **Step 6: Commit**

```bash
git add "app/src/app/(admin)/events/attendance/page.tsx"
git commit -m "feat(attendance): weekly trend stat cards and chart on admin dashboard"
```

---

### Task 4: "My attendance" section on /me

**Files:**
- Modify: `app/src/app/me/page.tsx`

- [ ] **Step 1: Add imports**

In `app/src/app/me/page.tsx`, extend the existing imports:

```tsx
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
```

And extend the existing drizzle-orm import (currently `import { and, asc, eq, isNull } from "drizzle-orm";`) to:

```tsx
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
```

- [ ] **Step 2: Select personId in the existing `me` lookup**

In the `const [me] = await db.select({...})` block, add one field:

```tsx
      personId: member.personId,
```

(after `memberId: member.memberId,`).

- [ ] **Step 3: Query attendance stats + recent check-ins**

After the `requests` query (ends around line 97) and before `const heads = await listActiveHeads();`, add:

```tsx
  const [attendanceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const recentCheckIns = await db
    .select({
      checkInId: checkIn.checkInId,
      eventName: event.name,
      checkedInAt: checkIn.checkedInAt,
    })
    .from(checkIn)
    .innerJoin(event, eq(checkIn.eventId, event.eventId))
    .where(eq(checkIn.personId, me.personId))
    .orderBy(desc(checkIn.checkedInAt))
    .limit(10);
```

- [ ] **Step 4: Render the section**

In the JSX, insert after the closing `</section>` of the Journey ladder block and before the `{/* My ministries */}` comment:

```tsx
      {/* My attendance */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">My attendance</h2>
        {attendanceStats.total === 0 ? (
          <p className="text-sm text-gray-500">No attendance recorded yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total", value: String(attendanceStats.total) },
                { label: "This year", value: String(attendanceStats.thisYear) },
                { label: "Last attended", value: attendanceStats.lastAttended ?? "—" },
              ].map((card) => (
                <div key={card.label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-gray-100">
              {recentCheckIns.map((c) => (
                <li
                  key={c.checkInId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-gray-900">{c.eventName}</span>
                  <span className="text-gray-500">
                    {c.checkedInAt.toISOString().split("T")[0]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
```

- [ ] **Step 5: Type-check**

Run (from `app/`): `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Visual check (optional if no local DB running)**

With local DB and a member account that has check-ins: open `http://localhost:3000/me`.
Expected: "My attendance" card between Journey and My ministries; member with zero check-ins sees "No attendance recorded yet."

- [ ] **Step 7: Commit**

```bash
git add app/src/app/me/page.tsx
git commit -m "feat(me): personal attendance history section"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full unit test suite**

Run (from `app/`): `npx vitest run`
Expected: all tests pass (245 existing + 7 new = 252).

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Production build**

Run (from `app/`): `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Commit any stragglers / finish**

```bash
git status
```

Expected: clean working tree (all work committed in Tasks 1–4). If anything uncommitted, commit it with an appropriate `feat(attendance):` message.
