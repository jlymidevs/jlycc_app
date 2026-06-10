# Church Calendar + Add-to-Calendar + Recurring Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `/church/calendar` page (month grid + agenda list) with per-event "Add to Calendar" (Google link + ICS download), plus admin recurring-series support that materializes weekly/monthly `event` rows.

**Architecture:** Hand-rolled server-rendered calendar (no new dependencies). Pure date-expansion functions tested with Vitest; thin DB generator; existing `event_series` table reused (no migration). All recurrence math in Asia/Manila local time (fixed UTC+8, no DST), stored UTC.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Drizzle ORM, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-10-church-calendar-design.md`

**Conventions in this codebase (follow them):**
- Server actions live in `app/src/actions/*.ts`, start with `"use server"`, parse `FormData`, validate with Zod via `safeParse`, return `{ errors }` on failure, `revalidatePath` + `redirect` on success.
- Drizzle bigint FK inserts use `as any` casts with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (see `app/src/actions/events.ts`).
- Unit tests import via `@/` alias, plain Vitest `describe/it/expect`, no DB mocking — only pure functions and Zod schemas get unit tests.
- All commands run from `app/` directory.
- E2E staff login helper: fill `/login` form with `admin@jly.church` / `changeme`, wait for `/members`.

---

### Task 1: Series validation schema

**Files:**
- Create: `app/src/lib/validations/series.ts`
- Test: `app/tests/unit/series.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/series.test.ts`:

```ts
// app/tests/unit/series.test.ts
import { describe, it, expect } from "vitest";
import { createSeriesSchema } from "@/lib/validations/series";

const validWeekly = {
  name: "Sunday Service",
  eventTypeId: 1,
  recurrencePattern: "WEEKLY" as const,
  startsOn: "2026-06-14",
  config: { dayOfWeek: 0, time: "09:00", durationMinutes: 120, venue: "Main Hall" },
};

describe("createSeriesSchema", () => {
  it("accepts valid weekly series", () => {
    expect(createSeriesSchema.safeParse(validWeekly).success).toBe(true);
  });

  it("accepts valid monthly series", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      recurrencePattern: "MONTHLY",
      config: { dayOfMonth: 1, time: "19:00", durationMinutes: 90 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects weekly series without dayOfWeek", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { time: "09:00", durationMinutes: 120 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects monthly series without dayOfMonth", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      recurrencePattern: "MONTHLY",
      config: { time: "09:00", durationMinutes: 120 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { ...validWeekly.config, time: "9am" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects endsOn before startsOn", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      endsOn: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createSeriesSchema.safeParse({ ...validWeekly, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfWeek out of range", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { ...validWeekly.config, dayOfWeek: 7 },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run tests/unit/series.test.ts`
Expected: FAIL — cannot resolve `@/lib/validations/series`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/validations/series.ts`:

```ts
// app/src/lib/validations/series.ts
import { z } from "zod";

export const recurrenceConfigSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  durationMinutes: z.number().int().positive("Duration required"),
  venue: z.string().optional(),
});

export const createSeriesSchema = z
  .object({
    name: z.string().min(1, "Series name required"),
    eventTypeId: z.number().int().positive("Event type required"),
    branchId: z.number().int().positive().optional(),
    recurrencePattern: z.enum(["WEEKLY", "MONTHLY"]),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date required"),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date")
      .optional(),
    config: recurrenceConfigSchema,
  })
  .superRefine((val, ctx) => {
    if (val.recurrencePattern === "WEEKLY" && val.config.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "dayOfWeek"],
        message: "Day of week required for weekly series",
      });
    }
    if (val.recurrencePattern === "MONTHLY" && val.config.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "dayOfMonth"],
        message: "Day of month required for monthly series",
      });
    }
    if (val.endsOn && val.endsOn < val.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "End date must be on or after start date",
      });
    }
  });

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type RecurrenceConfig = z.infer<typeof recurrenceConfigSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/series.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/series.ts tests/unit/series.test.ts
git commit -m "feat(series): validation schema for recurring event series"
```

---

### Task 2: Series date expansion (pure function)

**Files:**
- Create: `app/src/lib/series-expansion.ts`
- Test: `app/tests/unit/series-expansion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/series-expansion.test.ts`:

```ts
// app/tests/unit/series-expansion.test.ts
import { describe, it, expect } from "vitest";
import {
  expandSeriesDates,
  manilaDateTimeToUtc,
} from "@/lib/series-expansion";

describe("manilaDateTimeToUtc", () => {
  it("converts Manila local time to UTC (UTC+8)", () => {
    const d = manilaDateTimeToUtc("2026-06-14", "09:00");
    expect(d.toISOString()).toBe("2026-06-14T01:00:00.000Z");
  });

  it("handles midnight crossing into previous UTC day", () => {
    const d = manilaDateTimeToUtc("2026-06-14", "06:00");
    expect(d.toISOString()).toBe("2026-06-13T22:00:00.000Z");
  });
});

describe("expandSeriesDates — WEEKLY", () => {
  const rule = {
    recurrencePattern: "WEEKLY" as const,
    startsOn: "2026-06-14", // a Sunday
    endsOn: null,
    dayOfWeek: 0, // Sunday
    time: "09:00",
  };

  it("returns every Sunday in range", () => {
    const dates = expandSeriesDates(rule, "2026-06-14", "2026-07-05");
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-06-14T01:00:00.000Z",
      "2026-06-21T01:00:00.000Z",
      "2026-06-28T01:00:00.000Z",
      "2026-07-05T01:00:00.000Z",
    ]);
  });

  it("clamps to startsOn when range starts earlier", () => {
    const dates = expandSeriesDates(rule, "2026-06-01", "2026-06-20");
    expect(dates).toHaveLength(1);
    expect(dates[0].toISOString()).toBe("2026-06-14T01:00:00.000Z");
  });

  it("clamps to endsOn when rule ends inside range", () => {
    const dates = expandSeriesDates(
      { ...rule, endsOn: "2026-06-21" },
      "2026-06-14",
      "2026-07-31"
    );
    expect(dates).toHaveLength(2);
  });

  it("returns empty when endsOn is before range", () => {
    const dates = expandSeriesDates(
      { ...rule, endsOn: "2026-06-20" },
      "2026-07-01",
      "2026-07-31"
    );
    expect(dates).toEqual([]);
  });
});

describe("expandSeriesDates — MONTHLY", () => {
  it("returns matching day each month", () => {
    const dates = expandSeriesDates(
      {
        recurrencePattern: "MONTHLY",
        startsOn: "2026-06-01",
        endsOn: null,
        dayOfMonth: 15,
        time: "19:00",
      },
      "2026-06-01",
      "2026-08-31"
    );
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-06-15T11:00:00.000Z",
      "2026-07-15T11:00:00.000Z",
      "2026-08-15T11:00:00.000Z",
    ]);
  });

  it("skips months without day 31", () => {
    const dates = expandSeriesDates(
      {
        recurrencePattern: "MONTHLY",
        startsOn: "2026-06-01",
        endsOn: null,
        dayOfMonth: 31,
        time: "10:00",
      },
      "2026-06-01",
      "2026-09-30"
    );
    // June 30 days (skip), July 31 ✓, Aug 31 ✓, Sept 30 days (skip)
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-07-31T02:00:00.000Z",
      "2026-08-31T02:00:00.000Z",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/series-expansion.test.ts`
Expected: FAIL — cannot resolve `@/lib/series-expansion`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/series-expansion.ts`:

```ts
// app/src/lib/series-expansion.ts
// All recurrence math is Asia/Manila local. Manila is UTC+8 year-round (no DST),
// so a fixed offset is safe.
const MANILA_OFFSET = "+08:00";

export interface SeriesRule {
  recurrencePattern: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  startsOn: string; // YYYY-MM-DD (Manila local date)
  endsOn: string | null;
  dayOfWeek?: number; // 0=Sunday … 6=Saturday
  dayOfMonth?: number; // 1–31
  time: string; // HH:mm Manila local
}

export function manilaDateTimeToUtc(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00${MANILA_OFFSET}`);
}

/**
 * Expand a series rule into concrete occurrence start times (UTC Dates)
 * between `from` and `to` (inclusive, YYYY-MM-DD Manila local dates).
 * Only WEEKLY and MONTHLY are supported in Phase 1; other patterns yield [].
 */
export function expandSeriesDates(
  rule: SeriesRule,
  from: string,
  to: string
): Date[] {
  const start = rule.startsOn > from ? rule.startsOn : from;
  const end = rule.endsOn && rule.endsOn < to ? rule.endsOn : to;
  if (start > end) return [];

  const out: Date[] = [];
  // Iterate calendar days using UTC-midnight Dates (date-only strings parse as UTC).
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  while (cursor <= endDate) {
    const matches =
      rule.recurrencePattern === "WEEKLY"
        ? cursor.getUTCDay() === rule.dayOfWeek
        : rule.recurrencePattern === "MONTHLY"
          ? cursor.getUTCDate() === rule.dayOfMonth
          : false;
    if (matches) {
      out.push(manilaDateTimeToUtc(cursor.toISOString().slice(0, 10), rule.time));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/series-expansion.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/series-expansion.ts tests/unit/series-expansion.test.ts
git commit -m "feat(series): pure date expansion for weekly/monthly recurrence"
```

---

### Task 3: Calendar links (Google URL + ICS builder)

**Files:**
- Create: `app/src/lib/calendar-links.ts`
- Test: `app/tests/unit/calendar-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/calendar-links.test.ts`:

```ts
// app/tests/unit/calendar-links.test.ts
import { describe, it, expect } from "vitest";
import { googleCalendarUrl, buildIcs } from "@/lib/calendar-links";

const sample = {
  eventId: 42,
  name: "Sunday Service",
  startsAt: new Date("2026-06-14T01:00:00.000Z"),
  endsAt: new Date("2026-06-14T03:00:00.000Z"),
  venue: "Main Hall",
};
const detailUrl = "https://example.org/church/events/42";

describe("googleCalendarUrl", () => {
  it("builds template URL with UTC dates", () => {
    const url = new URL(googleCalendarUrl(sample, detailUrl));
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Sunday Service");
    expect(url.searchParams.get("dates")).toBe(
      "20260614T010000Z/20260614T030000Z"
    );
    expect(url.searchParams.get("location")).toBe("Main Hall");
    expect(url.searchParams.get("details")).toBe(detailUrl);
  });

  it("defaults end to start + 2 hours when endsAt is null", () => {
    const url = new URL(
      googleCalendarUrl({ ...sample, endsAt: null }, detailUrl)
    );
    expect(url.searchParams.get("dates")).toBe(
      "20260614T010000Z/20260614T030000Z"
    );
  });

  it("omits location when venue is null", () => {
    const url = new URL(googleCalendarUrl({ ...sample, venue: null }, detailUrl));
    expect(url.searchParams.has("location")).toBe(false);
  });
});

describe("buildIcs", () => {
  it("produces valid VCALENDAR with CRLF line endings", () => {
    const ics = buildIcs(sample, detailUrl);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("UID:event-42@jlycc");
    expect(lines).toContain("DTSTART:20260614T010000Z");
    expect(lines).toContain("DTEND:20260614T030000Z");
    expect(lines).toContain("SUMMARY:Sunday Service");
    expect(lines).toContain("LOCATION:Main Hall");
    expect(lines).toContain(`URL:${detailUrl}`);
    expect(lines).toContain("END:VEVENT");
    expect(lines).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
    // No bare \n anywhere
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const ics = buildIcs(
      { ...sample, name: "Praise; Worship, Night", venue: "Hall A, Annex" },
      detailUrl
    );
    expect(ics).toContain("SUMMARY:Praise\\; Worship\\, Night");
    expect(ics).toContain("LOCATION:Hall A\\, Annex");
  });

  it("omits LOCATION when venue is null", () => {
    const ics = buildIcs({ ...sample, venue: null }, detailUrl);
    expect(ics).not.toContain("LOCATION:");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/calendar-links.test.ts`
Expected: FAIL — cannot resolve `@/lib/calendar-links`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/calendar-links.ts`:

```ts
// app/src/lib/calendar-links.ts
export interface CalendarEventLike {
  eventId: number;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  venue: string | null;
}

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

// 2026-06-14T01:00:00.000Z → 20260614T010000Z
function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function endOrDefault(e: CalendarEventLike): Date {
  return e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION_MS);
}

export function googleCalendarUrl(
  e: CalendarEventLike,
  detailUrl: string
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${fmtUtc(e.startsAt)}/${fmtUtc(endOrDefault(e))}`,
    details: detailUrl,
  });
  if (e.venue) params.set("location", e.venue);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 text escaping
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(e: CalendarEventLike, detailUrl: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JLYCC//Church Calendar//EN",
    "BEGIN:VEVENT",
    `UID:event-${e.eventId}@jlycc`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(e.startsAt)}`,
    `DTEND:${fmtUtc(endOrDefault(e))}`,
    `SUMMARY:${escapeIcsText(e.name)}`,
    ...(e.venue ? [`LOCATION:${escapeIcsText(e.venue)}`] : []),
    `URL:${detailUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/calendar-links.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-links.ts tests/unit/calendar-links.test.ts
git commit -m "feat(calendar): Google Calendar URL + ICS builders"
```

---

### Task 4: ICS download route

**Files:**
- Create: `app/src/app/church/events/[id]/calendar.ics/route.ts`
- Modify: `app/.env.example` (add `APP_BASE_URL`)

No unit test (DB-backed route; covered by E2E in Task 10).

- [ ] **Step 1: Create route handler**

Create `app/src/app/church/events/[id]/calendar.ics/route.ts`:

```ts
// app/src/app/church/events/[id]/calendar.ics/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { eq } from "drizzle-orm";
import { buildIcs } from "@/lib/calendar-links";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const eventId = Number(params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [row] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      status: event.status,
    })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!row || row.status === "CANCELLED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const ics = buildIcs(row, `${base}/church/events/${row.eventId}`);
  const slug =
    row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event";

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}
```

- [ ] **Step 2: Add `APP_BASE_URL` to `.env.example`**

Append to `app/.env.example`:

```
# Public base URL used in ICS files and calendar links
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/church/events/[id]/calendar.ics/route.ts" .env.example
git commit -m "feat(calendar): ICS download route for events"
```

---

### Task 5: Series generator (materializes event rows)

**Files:**
- Create: `app/src/lib/series-generator.ts`

Thin DB layer over the tested pure expansion — no unit test (codebase has no DB mocking); covered by E2E in Task 10.

- [ ] **Step 1: Create generator**

Create `app/src/lib/series-generator.ts`:

```ts
// app/src/lib/series-generator.ts
import { db } from "@/lib/db";
import { event, eventSeries } from "@/schema/events";
import { eq } from "drizzle-orm";
import { expandSeriesDates } from "@/lib/series-expansion";
import type { RecurrenceConfig } from "@/lib/validations/series";

const HORIZON_DAYS = 92; // ~3 months ahead

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Materialize event rows for one series, from today up to HORIZON_DAYS ahead.
 * Idempotent: skips occurrences whose (seriesId, startsAt) already exists.
 * Returns count of rows inserted.
 */
export async function generateOccurrences(seriesId: number): Promise<number> {
  const [series] = await db
    .select()
    .from(eventSeries)
    .where(eq(eventSeries.seriesId, seriesId))
    .limit(1);
  if (!series || series.status !== "ACTIVE") return 0;

  const config = series.recurrenceConfig as RecurrenceConfig;
  const from = isoDate(new Date());
  const to = isoDate(new Date(Date.now() + HORIZON_DAYS * 86400000));

  const dates = expandSeriesDates(
    {
      recurrencePattern: series.recurrencePattern,
      startsOn: series.startsOn,
      endsOn: series.endsOn,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      time: config.time,
    },
    from,
    to
  );
  if (dates.length === 0) return 0;

  const existing = await db
    .select({ startsAt: event.startsAt })
    .from(event)
    .where(eq(event.seriesId, seriesId));
  const existingTimes = new Set(existing.map((r) => r.startsAt.getTime()));
  const missing = dates.filter((d) => !existingTimes.has(d.getTime()));
  if (missing.length === 0) return 0;

  await db.insert(event).values(
    missing.map((startsAt) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: series.eventTypeId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesId: series.seriesId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: series.branchId as any,
      name: series.name,
      startsAt,
      endsAt: new Date(startsAt.getTime() + config.durationMinutes * 60000),
      venue: config.venue ?? null,
    }))
  );
  return missing.length;
}

/**
 * Top up all ACTIVE series. Safe to call fire-and-forget on page load —
 * never throws.
 */
export async function topUpAllSeries(): Promise<void> {
  try {
    const active = await db
      .select({ seriesId: eventSeries.seriesId })
      .from(eventSeries)
      .where(eq(eventSeries.status, "ACTIVE"));
    for (const s of active) {
      await generateOccurrences(s.seriesId);
    }
  } catch (err) {
    console.error("series top-up failed", err);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If `series.startsOn` types mismatch: Drizzle `date()` columns return `string` — that matches `SeriesRule.startsOn: string`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/series-generator.ts
git commit -m "feat(series): occurrence generator with 3-month horizon"
```

---

### Task 6: Series server actions

**Files:**
- Create: `app/src/actions/series.ts`

- [ ] **Step 1: Create actions**

Create `app/src/actions/series.ts`:

```ts
// app/src/actions/series.ts
"use server";

import { db } from "@/lib/db";
import { event, eventSeries } from "@/schema/events";
import { createSeriesSchema } from "@/lib/validations/series";
import { generateOccurrences } from "@/lib/series-generator";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";

export async function createSeries(formData: FormData) {
  const dayOfWeekRaw = formData.get("dayOfWeek");
  const dayOfMonthRaw = formData.get("dayOfMonth");

  const raw = {
    name: formData.get("name"),
    eventTypeId: Number(formData.get("eventTypeId")),
    branchId: formData.get("branchId")
      ? Number(formData.get("branchId"))
      : undefined,
    recurrencePattern: formData.get("recurrencePattern"),
    startsOn: formData.get("startsOn"),
    endsOn: (formData.get("endsOn") as string) || undefined,
    config: {
      dayOfWeek:
        dayOfWeekRaw !== null && dayOfWeekRaw !== ""
          ? Number(dayOfWeekRaw)
          : undefined,
      dayOfMonth:
        dayOfMonthRaw !== null && dayOfMonthRaw !== ""
          ? Number(dayOfMonthRaw)
          : undefined,
      time: formData.get("time"),
      durationMinutes: Number(formData.get("durationMinutes")),
      venue: (formData.get("venue") as string) || undefined,
    },
  };

  const parsed = createSeriesSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const [row] = await db
    .insert(eventSeries)
    .values({
      name: d.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: d.eventTypeId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: d.branchId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recurrencePattern: d.recurrencePattern as any,
      recurrenceConfig: d.config,
      startsOn: d.startsOn,
      endsOn: d.endsOn,
    })
    .returning({ seriesId: eventSeries.seriesId });

  await generateOccurrences(row.seriesId);

  revalidatePath("/events/series");
  revalidatePath("/events");
  revalidatePath("/church/calendar");
  redirect("/events/series");
}

export async function cancelSeries(seriesId: number) {
  await db
    .update(eventSeries)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "ENDED" as any })
    .where(eq(eventSeries.seriesId, seriesId));

  await db
    .update(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "CANCELLED" as any })
    .where(
      and(
        eq(event.seriesId, seriesId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(event.status, "SCHEDULED" as any),
        gt(event.startsAt, new Date())
      )
    );

  revalidatePath("/events/series");
  revalidatePath("/events");
  revalidatePath("/church/calendar");
  redirect("/events/series");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/actions/series.ts
git commit -m "feat(series): create + cancel server actions"
```

---

### Task 7: Admin series pages

**Files:**
- Create: `app/src/app/(admin)/events/series/page.tsx` (list)
- Create: `app/src/app/(admin)/events/series/new/page.tsx` (form)
- Create: `app/src/app/(admin)/events/series/[id]/cancel/page.tsx` (confirm)
- Create: `app/src/components/series-pattern-fields.tsx` (client component — pattern-dependent day field)
- Modify: `app/src/app/(admin)/events/page.tsx` (add "Recurring series" link next to existing "Add event" button/header)

- [ ] **Step 1: Create client component for pattern-dependent fields**

Create `app/src/components/series-pattern-fields.tsx`:

```tsx
// app/src/components/series-pattern-fields.tsx
"use client";

import { useState } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function SeriesPatternFields() {
  const [pattern, setPattern] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Repeats <span className="text-red-500">*</span>
        </label>
        <select
          name="recurrencePattern"
          required
          value={pattern}
          onChange={(e) => setPattern(e.target.value as "WEEKLY" | "MONTHLY")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </div>

      {pattern === "WEEKLY" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day of week <span className="text-red-500">*</span>
          </label>
          <select
            name="dayOfWeek"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day of month <span className="text-red-500">*</span>
          </label>
          <input
            name="dayOfMonth"
            type="number"
            min="1"
            max="31"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create series list page**

Create `app/src/app/(admin)/events/series/page.tsx`:

```tsx
// app/src/app/(admin)/events/series/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { eventSeries, eventType } from "@/schema/events";
import { eq, desc } from "drizzle-orm";
import type { RecurrenceConfig } from "@/lib/validations/series";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function patternSummary(
  pattern: string,
  config: RecurrenceConfig
): string {
  if (pattern === "WEEKLY" && config.dayOfWeek !== undefined) {
    return `Every ${DAYS[config.dayOfWeek]} at ${config.time}`;
  }
  if (pattern === "MONTHLY" && config.dayOfMonth !== undefined) {
    return `Day ${config.dayOfMonth} of each month at ${config.time}`;
  }
  return pattern;
}

export default async function SeriesListPage() {
  const rows = await db
    .select({
      seriesId: eventSeries.seriesId,
      name: eventSeries.name,
      recurrencePattern: eventSeries.recurrencePattern,
      recurrenceConfig: eventSeries.recurrenceConfig,
      startsOn: eventSeries.startsOn,
      endsOn: eventSeries.endsOn,
      status: eventSeries.status,
      eventTypeName: eventType.name,
    })
    .from(eventSeries)
    .innerJoin(eventType, eq(eventSeries.eventTypeId, eventType.eventTypeId))
    .orderBy(desc(eventSeries.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/events"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Recurring series
          </h1>
        </div>
        <Link
          href="/events/series/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New series
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No recurring series yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Schedule</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.seriesId} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-900">{s.name}</td>
                <td className="py-2 pr-4 text-gray-600">{s.eventTypeName}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {patternSummary(
                    s.recurrencePattern,
                    s.recurrenceConfig as RecurrenceConfig
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "ACTIVE"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {s.status === "ACTIVE" && (
                    <Link
                      href={`/events/series/${s.seriesId}/cancel`}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel series
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create new-series form page**

Create `app/src/app/(admin)/events/series/new/page.tsx`:

```tsx
// app/src/app/(admin)/events/series/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { eventType } from "@/schema/events";
import { branch } from "@/schema/core";
import { createSeries } from "@/actions/series";
import SeriesPatternFields from "@/components/series-pattern-fields";

export default async function NewSeriesPage() {
  const eventTypes = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);
  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/events/series"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Recurring series
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New series</h1>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createSeries as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Series name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Sunday Worship Service"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event type <span className="text-red-500">*</span>
            </label>
            <select
              name="eventTypeId"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type…</option>
              {eventTypes.map((et) => (
                <option key={et.eventTypeId} value={et.eventTypeId}>
                  {et.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              name="branchId"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SeriesPatternFields />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time <span className="text-red-500">*</span>
            </label>
            <input
              name="time"
              type="time"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              name="durationMinutes"
              type="number"
              min="1"
              required
              defaultValue="120"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Venue
          </label>
          <input
            name="venue"
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts on <span className="text-red-500">*</span>
            </label>
            <input
              name="startsOn"
              type="date"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ends on
            </label>
            <input
              name="endsOn"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create series
          </button>
          <Link
            href="/events/series"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create cancel-confirmation page**

Create `app/src/app/(admin)/events/series/[id]/cancel/page.tsx`:

```tsx
// app/src/app/(admin)/events/series/[id]/cancel/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventSeries, eventRegistration } from "@/schema/events";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { cancelSeries } from "@/actions/series";

export default async function CancelSeriesPage({
  params,
}: {
  params: { id: string };
}) {
  const seriesId = Number(params.id);
  if (!Number.isInteger(seriesId) || seriesId <= 0) notFound();

  const [series] = await db
    .select({
      seriesId: eventSeries.seriesId,
      name: eventSeries.name,
      status: eventSeries.status,
    })
    .from(eventSeries)
    .where(eq(eventSeries.seriesId, seriesId))
    .limit(1);
  if (!series) notFound();

  const futureOccurrences = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      registrationCount: sql<number>`(
        select count(*) from events.event_registration er
        where er.event_id = ${event.eventId}
          and er.status != 'CANCELLED'
      )`.mapWith(Number),
    })
    .from(event)
    .where(
      and(
        eq(event.seriesId, seriesId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(event.status, "SCHEDULED" as any),
        gt(event.startsAt, new Date())
      )
    )
    .orderBy(event.startsAt);

  async function confirmCancel() {
    "use server";
    await cancelSeries(seriesId);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/events/series"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Recurring series
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Cancel series: {series.name}
        </h1>
      </div>

      {series.status !== "ACTIVE" ? (
        <p className="text-gray-500">This series is already ended.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            This ends the series and cancels the {futureOccurrences.length}{" "}
            upcoming occurrence{futureOccurrences.length === 1 ? "" : "s"}{" "}
            below. Past events are not affected. This cannot be undone.
          </p>

          {futureOccurrences.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {futureOccurrences.map((o) => (
                <li
                  key={o.eventId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-gray-900">
                    {new Date(o.startsAt).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {o.registrationCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      {o.registrationCount} registration
                      {o.registrationCount === 1 ? "" : "s"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={confirmCancel} className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cancel series
            </button>
            <Link
              href="/events/series"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Keep series
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
```

Note: the `sql` template references `events.event_registration` directly; `ne` import is unused — remove it if the linter complains.

- [ ] **Step 5: Link series pages from admin events page**

In `app/src/app/(admin)/events/page.tsx`, find the header area containing the "Add event" link/button and add a sibling link just before it:

```tsx
<Link
  href="/events/series"
  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
>
  Recurring series
</Link>
```

(Match the surrounding flex container; if the header is `flex items-center justify-between`, wrap the two buttons in `<div className="flex gap-3">…</div>`.)

- [ ] **Step 6: Verify compile + lint**

Run: `npx tsc --noEmit && npx next lint --dir src/app/\(admin\)/events --dir src/components`
(If the lint command's path escaping fails on Windows, run plain `npm run lint`.)
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/events/series" src/components/series-pattern-fields.tsx "src/app/(admin)/events/page.tsx"
git commit -m "feat(series): admin pages — list, create form, cancel confirmation"
```

---

### Task 8: Month-grid helpers (pure functions)

**Files:**
- Create: `app/src/lib/month-grid.ts`
- Test: `app/tests/unit/month-grid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/month-grid.test.ts`:

```ts
// app/tests/unit/month-grid.test.ts
import { describe, it, expect } from "vitest";
import {
  parseMonthParam,
  monthGridDays,
  monthRangeUtc,
  manilaDateOf,
  currentManilaMonth,
} from "@/lib/month-grid";

describe("currentManilaMonth", () => {
  it("returns YYYY-MM format", () => {
    expect(currentManilaMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});

describe("parseMonthParam", () => {
  it("parses valid month", () => {
    expect(parseMonthParam("2026-06")).toEqual({ year: 2026, month: 6 });
  });

  it("falls back to current month for garbage", () => {
    const current = currentManilaMonth();
    const expected = {
      year: Number(current.slice(0, 4)),
      month: Number(current.slice(5, 7)),
    };
    expect(parseMonthParam("not-a-month")).toEqual(expected);
    expect(parseMonthParam("2026-13")).toEqual(expected);
    expect(parseMonthParam(undefined)).toEqual(expected);
  });
});

describe("monthGridDays", () => {
  it("returns 42 cells starting on Sunday", () => {
    const cells = monthGridDays(2026, 6); // June 2026 starts Monday
    expect(cells).toHaveLength(42);
    expect(cells[0].date).toBe("2026-05-31"); // Sunday before June 1
    expect(cells[1].date).toBe("2026-06-01");
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].inMonth).toBe(true);
  });

  it("marks out-of-month trailing cells", () => {
    const cells = monthGridDays(2026, 6);
    const last = cells[41];
    expect(last.date).toBe("2026-07-11");
    expect(last.inMonth).toBe(false);
  });
});

describe("monthRangeUtc", () => {
  it("returns Manila month boundaries in UTC", () => {
    const { start, end } = monthRangeUtc(2026, 6);
    // June 1 00:00 Manila = May 31 16:00 UTC
    expect(start.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    // July 1 00:00 Manila = June 30 16:00 UTC
    expect(end.toISOString()).toBe("2026-06-30T16:00:00.000Z");
  });
});

describe("manilaDateOf", () => {
  it("buckets a UTC instant into its Manila calendar date", () => {
    // June 13 22:00 UTC = June 14 06:00 Manila
    expect(manilaDateOf(new Date("2026-06-13T22:00:00.000Z"))).toBe(
      "2026-06-14"
    );
    expect(manilaDateOf(new Date("2026-06-14T01:00:00.000Z"))).toBe(
      "2026-06-14"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/month-grid.test.ts`
Expected: FAIL — cannot resolve `@/lib/month-grid`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/month-grid.ts`:

```ts
// app/src/lib/month-grid.ts
// Calendar month helpers. All "calendar dates" are Asia/Manila local (UTC+8, no DST).

export interface GridCell {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

export function currentManilaMonth(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

export function parseMonthParam(param: string | undefined): {
  year: number;
  month: number;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const str =
    m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? param! : currentManilaMonth();
  return { year: Number(str.slice(0, 4)), month: Number(str.slice(5, 7)) };
}

/** 42 cells (6 weeks), Sunday-first, covering the given month. */
export function monthGridDays(year: number, month: number): GridCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - first.getUTCDay());
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getUTCMonth() === month - 1,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

/** UTC instants bounding the Manila-local month: [start, end). */
export function monthRangeUtc(
  year: number,
  month: number
): { start: Date; end: Date } {
  const mm = String(month).padStart(2, "0");
  const start = new Date(`${year}-${mm}-01T00:00:00+08:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nm = String(nextMonth).padStart(2, "0");
  const end = new Date(`${nextYear}-${nm}-01T00:00:00+08:00`);
  return { start, end };
}

/** Manila calendar date (YYYY-MM-DD) of a UTC instant. */
export function manilaDateOf(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/month-grid.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/month-grid.ts tests/unit/month-grid.test.ts
git commit -m "feat(calendar): month grid + Manila timezone helpers"
```

---

### Task 9: Public calendar page

**Files:**
- Create: `app/src/components/calendar-view-toggle.tsx` (client)
- Create: `app/src/app/church/calendar/page.tsx` (server)
- Modify: `app/src/app/church/layout.tsx` (add nav link)

- [ ] **Step 1: Create view toggle client component**

Create `app/src/components/calendar-view-toggle.tsx`:

```tsx
// app/src/components/calendar-view-toggle.tsx
"use client";

import { useEffect, useState } from "react";

type View = "grid" | "list";

export default function CalendarViewToggle({
  grid,
  list,
}: {
  grid: React.ReactNode;
  list: React.ReactNode;
}) {
  // null until hydrated → CSS responsive default (grid ≥ md, list below)
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("calendarView");
    if (saved === "grid" || saved === "list") setView(saved);
    else setView(window.innerWidth >= 768 ? "grid" : "list");
  }, []);

  function select(v: View) {
    setView(v);
    window.localStorage.setItem("calendarView", v);
  }

  const btn = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => select(v)}
      aria-pressed={view === v}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        view === v
          ? "bg-blue-600 text-white"
          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {btn("grid", "Grid")}
        {btn("list", "List")}
      </div>
      <div
        className={
          view === null ? "hidden md:block" : view === "grid" ? "" : "hidden"
        }
      >
        {grid}
      </div>
      <div
        className={
          view === null ? "md:hidden" : view === "list" ? "" : "hidden"
        }
      >
        {list}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create calendar page**

Create `app/src/app/church/calendar/page.tsx`:

```tsx
// app/src/app/church/calendar/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import {
  parseMonthParam,
  monthGridDays,
  monthRangeUtc,
  manilaDateOf,
  currentManilaMonth,
} from "@/lib/month-grid";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { topUpAllSeries } from "@/lib/series-generator";
import CalendarViewToggle from "@/components/calendar-view-toggle";

const PILL_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

function categoryColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return PILL_COLORS[h % PILL_COLORS.length];
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ChurchCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; type?: string };
}) {
  await topUpAllSeries(); // never throws

  const { year, month } = parseMonthParam(searchParams.month);
  const { start, end } = monthRangeUtc(year, month);
  const typeFilter = searchParams.type ? Number(searchParams.type) : undefined;

  const conditions = [
    inArray(event.status, [
      "SCHEDULED",
      "IN_PROGRESS",
    ] as ("SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED")[]),
    gte(event.startsAt, start),
    lt(event.startsAt, end),
  ];
  if (typeFilter && Number.isInteger(typeFilter)) {
    conditions.push(eq(event.eventTypeId, typeFilter));
  }

  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      eventTypeId: event.eventTypeId,
      eventTypeName: eventType.name,
      categoryCode: eventType.categoryCode,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(and(...conditions))
    .orderBy(asc(event.startsAt));

  const types = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);

  // Bucket events by Manila calendar date
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = manilaDateOf(r.startsAt);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(r);
    else byDate.set(key, [r]);
  }

  const cells = monthGridDays(year, month);
  const todayStr = manilaDateOf(new Date());
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const monthParam = `${year}-${String(month).padStart(2, "0")}`;
  const qs = (m: string) =>
    `?month=${m}${typeFilter ? `&type=${typeFilter}` : ""}`;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    });

  const grid = (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200 text-center text-xs font-medium text-gray-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-24 border-b border-r border-gray-100 p-1 ${
                cell.inMonth ? "bg-white" : "bg-gray-50"
              }`}
            >
              <div
                className={`mb-1 text-xs ${
                  cell.date === todayStr
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-semibold text-white"
                    : cell.inMonth
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {Number(cell.date.slice(8, 10))}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <Link
                    key={e.eventId}
                    href={`/church/events/${e.eventId}`}
                    className={`block truncate rounded px-1 py-0.5 text-xs ${categoryColor(e.categoryCode)}`}
                    title={`${e.name} · ${fmtTime(e.startsAt)}`}
                  >
                    {e.name}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-xs text-gray-500">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const listDates = [...byDate.keys()].sort();
  const list = (
    <div className="space-y-6">
      {listDates.length === 0 ? (
        <p className="text-gray-500">No events this month.</p>
      ) : (
        listDates.map((date) => (
          <div key={date} id={`d-${date}`} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">
              {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </h3>
            {(byDate.get(date) ?? []).map((e) => (
              <div
                key={e.eventId}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/church/events/${e.eventId}`}
                      className="font-medium text-gray-900 hover:text-blue-700"
                    >
                      {e.name}
                    </Link>
                    <p className="text-xs text-gray-500">{e.eventTypeName}</p>
                  </div>
                  <Link
                    href={`/church/events/${e.eventId}`}
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Register
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>🕘 {fmtTime(e.startsAt)}</span>
                  {e.venue && <span>📍 {e.venue}</span>}
                </div>
                <div className="flex gap-3 text-sm">
                  <a
                    href={googleCalendarUrl(
                      e,
                      `${base}/church/events/${e.eventId}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Add to Google Calendar
                  </a>
                  <a
                    href={`/church/events/${e.eventId}/calendar.ics`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Download .ics
                  </a>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          {monthLabel(year, month)}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/church/calendar${qs(shiftMonth(year, month, -1))}`}
            aria-label="Previous month"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ←
          </Link>
          <Link
            href={`/church/calendar${qs(currentManilaMonth())}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Today
          </Link>
          <Link
            href={`/church/calendar${qs(shiftMonth(year, month, 1))}`}
            aria-label="Next month"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/church/calendar?month=${monthParam}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !typeFilter
              ? "bg-blue-600 text-white"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t.eventTypeId}
            href={`/church/calendar?month=${monthParam}&type=${t.eventTypeId}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              typeFilter === t.eventTypeId
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.name}
          </Link>
        ))}
      </div>

      <CalendarViewToggle grid={grid} list={list} />
    </div>
  );
}
```

- [ ] **Step 3: Add nav link**

In `app/src/app/church/layout.tsx`, replace the single Events link with a links group:

```tsx
<div className="flex items-center gap-5">
  <Link
    href="/church/calendar"
    className="text-sm text-gray-600 hover:text-gray-900"
  >
    Calendar
  </Link>
  <Link
    href="/church/events"
    className="text-sm text-gray-600 hover:text-gray-900"
  >
    Events
  </Link>
</div>
```

- [ ] **Step 4: Verify compile + all unit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no TS errors; all unit tests pass (216 pre-existing + ~29 new)

- [ ] **Step 5: Manual smoke check (optional but recommended)**

Run: `npm run dev`, open `http://localhost:3000/church/calendar`. Verify month renders, prev/next work, grid/list toggle works, list rows show both add-to-calendar links. Requires local DB (`cd ../db && docker compose up -d`).

- [ ] **Step 6: Commit**

```bash
git add src/app/church/calendar src/components/calendar-view-toggle.tsx src/app/church/layout.tsx
git commit -m "feat(calendar): public church calendar with month grid, agenda list, add-to-calendar"
```

---

### Task 10: E2E tests

**Files:**
- Create: `app/tests/e2e/calendar.spec.ts`

- [ ] **Step 1: Write E2E spec**

Create `app/tests/e2e/calendar.spec.ts`:

```ts
// app/tests/e2e/calendar.spec.ts
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

test.describe("Public church calendar", () => {
  test("renders current month with navigation", async ({ page }) => {
    await page.goto("/church/calendar");
    // Month heading like "June 2026"
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toContainText(/\b20\d{2}\b/);
    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  });

  test("prev/next navigation changes month", async ({ page }) => {
    await page.goto("/church/calendar?month=2026-06");
    await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Previous month" }).click();
    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(page.getByRole("heading", { name: "May 2026" })).toBeVisible();
  });

  test("grid/list toggle switches view", async ({ page }) => {
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    await expect(
      page.getByRole("button", { name: "List" })
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Grid" }).click();
    await expect(page.getByText("Sun", { exact: true })).toBeVisible();
  });
});

test.describe("Recurring series → calendar", () => {
  test("admin creates weekly series; occurrences appear on public calendar with add-to-calendar links", async ({
    page,
  }) => {
    await staffLogin(page);

    const seriesName = `E2E Weekly Service ${Date.now()}`;
    await page.goto("/events/series/new");
    await page.fill('input[name="name"]', seriesName);
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    // WEEKLY is default; pick Sunday
    await page.selectOption('select[name="dayOfWeek"]', "0");
    await page.fill('input[name="time"]', "09:00");
    await page.fill('input[name="durationMinutes"]', "120");
    await page.fill('input[name="venue"]', "Main Hall");
    // Start today so occurrences fall in current + next months
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('input[name="startsOn"]', today);
    await page.getByRole("button", { name: "Create series" }).click();

    await page.waitForURL("/events/series");
    await expect(page.getByText(seriesName)).toBeVisible();

    // Public calendar (list view) shows an occurrence within ~2 months
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    let found = await page.getByText(seriesName).first().isVisible().catch(() => false);
    if (!found) {
      await page.getByRole("link", { name: "Next month" }).click();
      await page.getByRole("button", { name: "List" }).click();
      found = await page.getByText(seriesName).first().isVisible().catch(() => false);
    }
    expect(found).toBe(true);

    // Add-to-calendar links present on list rows
    await expect(
      page.getByRole("link", { name: "Add to Google Calendar" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download .ics" }).first()
    ).toBeVisible();
  });

  test("ics endpoint returns text/calendar", async ({ page, request }) => {
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    const icsLink = page.getByRole("link", { name: "Download .ics" }).first();
    if (!(await icsLink.isVisible().catch(() => false))) {
      test.skip(true, "no events this month");
    }
    const href = await icsLink.getAttribute("href");
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
  });

  test("admin cancels series; future occurrences leave the calendar", async ({
    page,
  }) => {
    await staffLogin(page);

    // Create a dedicated series to cancel
    const seriesName = `E2E Cancel Me ${Date.now()}`;
    await page.goto("/events/series/new");
    await page.fill('input[name="name"]', seriesName);
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    await page.selectOption('select[name="dayOfWeek"]', "3");
    await page.fill('input[name="time"]', "19:00");
    await page.fill('input[name="durationMinutes"]', "60");
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('input[name="startsOn"]', today);
    await page.getByRole("button", { name: "Create series" }).click();
    await page.waitForURL("/events/series");

    // Cancel it
    const row = page.locator("tr", { hasText: seriesName });
    await row.getByRole("link", { name: "Cancel series" }).click();
    await page.waitForURL(/\/events\/series\/\d+\/cancel/);
    await expect(
      page.getByRole("heading", { name: `Cancel series: ${seriesName}` })
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel series" }).click();
    await page.waitForURL("/events/series");
    await expect(
      page.locator("tr", { hasText: seriesName }).getByText("ENDED")
    ).toBeVisible();

    // Public calendar no longer lists it
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.getByText(seriesName)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run E2E**

Requires local DB + dev server (Playwright config handles webServer if configured; otherwise run `npm run dev` separately).

Run: `npx playwright test tests/e2e/calendar.spec.ts`
Expected: all calendar tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/calendar.spec.ts
git commit -m "test(calendar): e2e coverage for calendar, series lifecycle, ics endpoint"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all tests pass (no regressions in the 216 pre-existing)

- [ ] **Step 2: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build

- [ ] **Step 3: Full E2E suite**

Run: `npx playwright test`
Expected: no new failures vs. pre-existing baseline (some specs already skip)

- [ ] **Step 4: Update CLAUDE.md progress section**

In `JLYCC App/CLAUDE.md`, under "Current Progress → Completed", add:

```
- **Plan 17 — Church Calendar**: public month calendar, add-to-calendar (Google + ICS), recurring series admin (PR #13)
```

- [ ] **Step 5: Commit**

```bash
git add ../CLAUDE.md
git commit -m "docs: record church calendar plan completion"
```

---

## Self-Review Notes

- Spec coverage: calendar page (Task 9), grid/list toggle (Tasks 9), add-to-calendar Google + ICS (Tasks 3–4, 9), recurring series create/generator/cancel (Tasks 1–2, 5–7), nav link (Task 9), error handling (404 in Task 4, month fallback in Task 8, generator never-throws in Task 5), tests (Tasks 1–3, 8, 10).
- Out of scope per spec: event detail page buttons, member portal, series editing, ICS feed subscription.
