# Plan 6c: Public Church Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public church homepage at `/church` with a hero section and upcoming events list, plus a shared nav layout wrapping all `/church/*` pages.

**Architecture:** Two new files only — `church/layout.tsx` (public nav bar, no auth) and `church/page.tsx` (hero + next 5 events query). The layout automatically applies to existing `/church/events` and `/church/events/[id]` pages with zero changes to those files.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM (`event`, `eventType` tables already defined).

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/src/app/church/layout.tsx` |
| Create | `app/src/app/church/page.tsx` |
| Create | `app/tests/e2e/homepage.spec.ts` |

No files modified. No migrations.

---

### Task 1: Public Layout

Shared nav for all `/church/*` routes. No auth. Just a top bar + children wrapper.

**Files:**
- Create: `app/src/app/church/layout.tsx`

- [ ] **Step 1: Create layout file**

```tsx
// app/src/app/church/layout.tsx
import Link from "next/link";

export default function ChurchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/church"
          className="font-semibold text-gray-900 hover:text-gray-700"
        >
          JLY Church
        </Link>
        <Link
          href="/church/events"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Events
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/church/layout.tsx
git commit -m "feat(public): add shared nav layout for /church/* pages"
```

---

### Task 2: Homepage

Hero section + next 5 upcoming events. Same query pattern as `app/src/app/church/events/page.tsx` but limited to 5 and with a hero above.

**Files:**
- Create: `app/src/app/church/page.tsx`

- [ ] **Step 1: Create homepage file**

```tsx
// app/src/app/church/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, inArray, asc } from "drizzle-orm";

export default async function ChurchHomePage() {
  const upcomingEvents = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      venue: event.venue,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(
      inArray(
        event.status,
        ["SCHEDULED", "IN_PROGRESS"] as (
          | "SCHEDULED"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED"
        )[]
      )
    )
    .orderBy(asc(event.startsAt))
    .limit(5);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">JLY Church</h1>
        <p className="text-lg text-gray-600">
          Love God. Love People. Change the World.
        </p>
        <Link
          href="/church/events"
          className="inline-block rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          See all events
        </Link>
      </section>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500">No upcoming events at this time.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((e) => (
              <div
                key={e.eventId}
                className="rounded-lg border border-gray-200 bg-white p-5 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.eventTypeName}</p>
                  <div className="flex gap-3 text-sm text-gray-600">
                    <span>
                      {new Date(e.startsAt).toLocaleDateString("en-PH", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {e.venue && <span>· {e.venue}</span>}
                  </div>
                </div>
                <Link
                  href={`/church/events/${e.eventId}`}
                  className="ml-4 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Register →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/church/page.tsx
git commit -m "feat(public): add church homepage with hero and upcoming events"
```

---

### Task 3: E2E Tests + Build Check

**Files:**
- Create: `app/tests/e2e/homepage.spec.ts`

- [ ] **Step 1: Create E2E test file**

```typescript
// app/tests/e2e/homepage.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Public church homepage", () => {
  test("homepage loads with JLY Church heading", async ({ page }) => {
    await page.goto("/church");
    await expect(
      page.getByRole("heading", { name: "JLY Church", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Love God. Love People. Change the World.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See all events" })).toBeVisible();
  });

  test("nav shows JLY Church and Events links", async ({ page }) => {
    await page.goto("/church");
    await expect(page.getByRole("link", { name: "JLY Church" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Events" })).toBeVisible();
  });

  test("Events nav link navigates to /church/events", async ({ page }) => {
    await page.goto("/church");
    await page.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL("/church/events");
    await expect(
      page.getByRole("heading", { name: "Upcoming Events" })
    ).toBeVisible();
  });

  test("upcoming events section visible (with or without events)", async ({ page }) => {
    await page.goto("/church");
    await expect(
      page.getByRole("heading", { name: "Upcoming Events" })
    ).toBeVisible();
    // Either shows events or empty state — both valid
    const hasEvents = await page.locator('a:has-text("Register →")').count() > 0;
    const hasEmpty = await page.getByText("No upcoming events at this time.").count() > 0;
    expect(hasEvents || hasEmpty).toBe(true);
  });

  test("nav is present on /church/events (layout applied)", async ({ page }) => {
    await page.goto("/church/events");
    await expect(page.getByRole("link", { name: "JLY Church" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Events" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit E2E tests**

```bash
git add app/tests/e2e/homepage.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for public homepage and nav"
```

- [ ] **Step 3: Run unit tests**

```bash
cd app && npx vitest run
```

Expected: 34 tests pass (no new unit tests for this feature — pure UI).

- [ ] **Step 4: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Production build**

```bash
cd app && npm run build
```

Expected: build succeeds. `/church` and `/church/events` render as `ƒ` (dynamic).

If prerender error on `/church`: verify `export const dynamic = "force-dynamic"` is present at line 1 of `app/src/app/church/page.tsx`.

- [ ] **Step 6: Commit build fix if needed**

Only if Step 5 required a change:
```bash
git add app/src/app/church/page.tsx
git commit -m "fix(build): ensure church homepage is force-dynamic"
```

---

## Self-Review

**Spec coverage:**
- ✅ `church/layout.tsx` — Task 1
- ✅ `church/page.tsx` — Task 2
- ✅ Hero: "JLY Church" + tagline + "See all events" link — Task 2
- ✅ Upcoming events: next 5 SCHEDULED/IN_PROGRESS ordered by startsAt ASC — Task 2
- ✅ Each event: name, type, date, venue, "Register →" link — Task 2
- ✅ Empty state — Task 2
- ✅ `export const dynamic = "force-dynamic"` — Task 2
- ✅ No changes to existing events pages — confirmed (file map has no modifications)
- ✅ E2E tests — Task 3
- ✅ Build check — Task 3

**Type consistency:** `inArray` cast pattern copied verbatim from existing `church/events/page.tsx` — consistent.
