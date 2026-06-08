# Plan 6a: Events Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staff-facing event management (create/edit/cancel/view registrants) and a public event listing + registration portal to the JLY Church App.

**Architecture:** Staff routes live at `/events/*` inside the existing `(admin)` route group (auth-protected). Public routes live at `/church/events/*` — placed directly in `app/src/app/church/` (no route group) to avoid URL collision with the admin `/events` segment. No new DB migrations: all five `events.*` tables were created in V033–V037. Registrations use `person_id` (not `member_id`) so non-members can register; the public form finds or creates a `core.person` by email.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM (`postgres` driver), Zod, Tailwind CSS, Auth.js v5, Vitest, Playwright

> **Spec note:** The approved design doc listed `(public)` as a route group at `/events`. Route groups don't add URL segments, so `(public)/events` and `(admin)/events` would both resolve to `/events` — a Next.js conflict. This plan uses `/church/events` for public pages instead.

---

## File Map

**New files:**
| File | Purpose |
|---|---|
| `app/src/schema/events.ts` | Drizzle table defs: eventType, event, eventSeries, eventRegistration + enums |
| `app/src/lib/validations/event.ts` | Zod schemas: createEvent, updateEvent, publicRegister |
| `app/src/actions/events.ts` | createEvent, updateEvent, cancelEvent server actions |
| `app/src/actions/registrations.ts` | registerForEvent (public), updateRegistrationStatus (staff) |
| `app/src/app/(admin)/events/page.tsx` | Staff event list |
| `app/src/app/(admin)/events/new/page.tsx` | Staff create event form |
| `app/src/app/(admin)/events/[id]/page.tsx` | Staff event detail + inline registrant list |
| `app/src/app/(admin)/events/[id]/edit/page.tsx` | Staff edit event form |
| `app/src/app/church/events/page.tsx` | Public event listing |
| `app/src/app/church/events/[id]/page.tsx` | Public event detail + registration form |
| `app/tests/unit/event.test.ts` | Vitest: Zod schema unit tests |
| `app/tests/e2e/events.spec.ts` | Playwright: 7 E2E scenarios |

**Modified files:**
| File | Change |
|---|---|
| `app/middleware.ts` | Protect `/events` and `/events/:path*` |
| `app/src/app/(admin)/layout.tsx` | Add Events nav link |

---

## Task 1: Drizzle Events Schema

**Files:**
- Create: `app/src/schema/events.ts`

- [ ] **Step 1: Create `app/src/schema/events.ts`**

```typescript
// app/src/schema/events.ts
import {
  bigserial,
  bigint,
  text,
  timestamp,
  integer,
  date,
  jsonb,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";

export const eventsSchema = pgSchema("events");

export const eventStatusEnum = eventsSchema.enum("event_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const registrationStatusEnum = eventsSchema.enum("registration_status", [
  "REGISTERED",
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
  "NO_SHOW",
]);

export const recurrencePatternEnum = eventsSchema.enum("recurrence_pattern", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const seriesStatusEnum = eventsSchema.enum("series_status", [
  "ACTIVE",
  "PAUSED",
  "ENDED",
]);

export const eventType = eventsSchema.table("event_type", {
  eventTypeId: bigserial("event_type_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryCode: text("category_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventSeries = eventsSchema.table("event_series", {
  seriesId: bigserial("series_id", { mode: "number" }).primaryKey(),
  eventTypeId: bigint("event_type_id", { mode: "number" })
    .notNull()
    .references(() => eventType.eventTypeId),
  branchId: bigint("branch_id", { mode: "number" }).references(
    () => branch.branchId
  ),
  name: text("name").notNull(),
  recurrencePattern: recurrencePatternEnum("recurrence_pattern").notNull(),
  recurrenceConfig: jsonb("recurrence_config").notNull().default({}),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  status: seriesStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const event = eventsSchema.table("event", {
  eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
  eventTypeId: bigint("event_type_id", { mode: "number" })
    .notNull()
    .references(() => eventType.eventTypeId),
  seriesId: bigint("series_id", { mode: "number" }).references(
    () => eventSeries.seriesId
  ),
  branchId: bigint("branch_id", { mode: "number" }).references(
    () => branch.branchId
  ),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  venue: text("venue"),
  expectedAttendance: integer("expected_attendance"),
  status: eventStatusEnum("status").notNull().default("SCHEDULED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventRegistration = eventsSchema.table("event_registration", {
  registrationId: bigserial("registration_id", { mode: "number" }).primaryKey(),
  eventId: bigint("event_id", { mode: "number" })
    .notNull()
    .references(() => event.eventId),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: registrationStatusEnum("status").notNull().default("REGISTERED"),
  groupSize: integer("group_size").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```
Expected: no errors (or only pre-existing errors unrelated to events.ts).

- [ ] **Step 3: Commit**

```bash
git add app/src/schema/events.ts
git commit -m "feat(schema): add Drizzle events schema definitions"
```

---

## Task 2: Zod Validation Schemas + Unit Tests

**Files:**
- Create: `app/src/lib/validations/event.ts`
- Create: `app/tests/unit/event.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `app/tests/unit/event.test.ts`:

```typescript
// app/tests/unit/event.test.ts
import { describe, it, expect } from "vitest";
import {
  createEventSchema,
  updateEventSchema,
  publicRegisterSchema,
} from "@/lib/validations/event";

describe("createEventSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createEventSchema.safeParse({
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = createEventSchema.safeParse({
      name: "",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing eventTypeId", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("eventTypeId");
  });

  it("rejects missing startsAt", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("startsAt");
  });

  it("accepts optional venue and expectedAttendance", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
      venue: "Main Hall",
      expectedAttendance: 200,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative expectedAttendance", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
      expectedAttendance: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("accepts partial update with just name", () => {
    const result = updateEventSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateEventSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("publicRegisterSchema", () => {
  it("accepts valid name and email", () => {
    const result = publicRegisterSchema.safeParse({
      name: "Maria Santos",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = publicRegisterSchema.safeParse({
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = publicRegisterSchema.safeParse({
      name: "",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = publicRegisterSchema.safeParse({
      name: "Maria Santos",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("rejects missing email", () => {
    const result = publicRegisterSchema.safeParse({ name: "Maria Santos" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd app && npx vitest run tests/unit/event.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/validations/event'`

- [ ] **Step 3: Create `app/src/lib/validations/event.ts`**

```typescript
// app/src/lib/validations/event.ts
import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().min(1, "Event name required"),
  eventTypeId: z.number().int().positive("Event type required"),
  startsAt: z.string().min(1, "Start date/time required"),
  endsAt: z.string().optional(),
  venue: z.string().optional(),
  expectedAttendance: z.number().int().positive().optional(),
  seriesId: z.number().int().positive().optional(),
  branchId: z.number().int().positive().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const publicRegisterSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type PublicRegisterInput = z.infer<typeof publicRegisterSchema>;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd app && npx vitest run tests/unit/event.test.ts
```
Expected: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/event.ts app/tests/unit/event.test.ts
git commit -m "feat(validation): add event Zod schemas with unit tests"
```

---

## Task 3: Staff Event Server Actions

**Files:**
- Create: `app/src/actions/events.ts`

- [ ] **Step 1: Create `app/src/actions/events.ts`**

```typescript
// app/src/actions/events.ts
"use server";

import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { createEventSchema, updateEventSchema } from "@/lib/validations/event";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createEvent(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    eventTypeId: Number(formData.get("eventTypeId")),
    startsAt: formData.get("startsAt") as string,
    endsAt: (formData.get("endsAt") as string) || undefined,
    venue: (formData.get("venue") as string) || undefined,
    expectedAttendance: formData.get("expectedAttendance")
      ? Number(formData.get("expectedAttendance"))
      : undefined,
    seriesId: formData.get("seriesId")
      ? Number(formData.get("seriesId"))
      : undefined,
    branchId: formData.get("branchId")
      ? Number(formData.get("branchId"))
      : undefined,
  };

  const parsed = createEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [newEvent] = await db
    .insert(event)
    .values({
      name: data.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: data.eventTypeId as any,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      venue: data.venue,
      expectedAttendance: data.expectedAttendance,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesId: data.seriesId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: data.branchId as any,
    })
    .returning({ eventId: event.eventId });

  revalidatePath("/events");
  redirect(`/events/${newEvent.eventId}`);
}

export async function updateEvent(eventId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    eventTypeId: formData.get("eventTypeId")
      ? Number(formData.get("eventTypeId"))
      : undefined,
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
    venue: (formData.get("venue") as string) || undefined,
    expectedAttendance: formData.get("expectedAttendance")
      ? Number(formData.get("expectedAttendance"))
      : undefined,
  };

  const parsed = updateEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(event)
    .set({
      ...(data.name && { name: data.name }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(data.eventTypeId && { eventTypeId: data.eventTypeId as any }),
      ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && {
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      }),
      ...(data.venue !== undefined && { venue: data.venue || null }),
      ...(data.expectedAttendance !== undefined && {
        expectedAttendance: data.expectedAttendance,
      }),
    })
    .where(eq(event.eventId, eventId));

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function cancelEvent(eventId: number) {
  await db
    .update(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "CANCELLED" as any })
    .where(eq(event.eventId, eventId));

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/events.ts
git commit -m "feat(actions): add staff event server actions"
```

---

## Task 4: Registration Server Actions

**Files:**
- Create: `app/src/actions/registrations.ts`

- [ ] **Step 1: Create `app/src/actions/registrations.ts`**

```typescript
// app/src/actions/registrations.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { event, eventRegistration } from "@/schema/events";
import { publicRegisterSchema } from "@/lib/validations/event";
import { revalidatePath } from "next/cache";
import { and, eq, ne, inArray, count } from "drizzle-orm";

export async function registerForEvent(
  eventId: number,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
  };

  const parsed = publicRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: firstError };
  }

  const { name, email } = parsed.data;

  // Find existing person by email
  const existingContact = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .where(and(eq(contactInfo.type, "EMAIL"), eq(contactInfo.value, email)))
    .limit(1);

  let personId: number;

  if (existingContact.length > 0) {
    personId = existingContact[0].personId;
  } else {
    // Split name into first/last (last word = last name, rest = first name)
    const nameParts = name.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts.pop()! : "";
    const firstName = nameParts.join(" ") || name.trim();

    const [newPerson] = await db
      .insert(person)
      .values({ firstName, lastName: lastName || firstName })
      .returning({ personId: person.personId });

    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });

    personId = newPerson.personId;
  }

  // Check for duplicate registration (non-cancelled)
  const duplicate = await db
    .select({ registrationId: eventRegistration.registrationId })
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.personId, personId),
        ne(eventRegistration.status, "CANCELLED")
      )
    )
    .limit(1);

  if (duplicate.length > 0) {
    return { error: "already_registered" };
  }

  // Check capacity
  const [eventRow] = await db
    .select({ expectedAttendance: event.expectedAttendance })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  let registrationStatus: "REGISTERED" | "WAITLISTED" = "REGISTERED";

  if (eventRow?.expectedAttendance) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(eventRegistration)
      .where(
        and(
          eq(eventRegistration.eventId, eventId),
          inArray(eventRegistration.status, ["REGISTERED", "CONFIRMED"])
        )
      );

    if (total >= eventRow.expectedAttendance) {
      registrationStatus = "WAITLISTED";
    }
  }

  await db.insert(eventRegistration).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventId: eventId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: registrationStatus as any,
  });

  return { success: true };
}

export async function updateRegistrationStatus(
  registrationId: number,
  newStatus: "CONFIRMED" | "CANCELLED"
) {
  const [reg] = await db
    .select({ eventId: eventRegistration.eventId })
    .from(eventRegistration)
    .where(eq(eventRegistration.registrationId, registrationId))
    .limit(1);

  await db
    .update(eventRegistration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: newStatus as any })
    .where(eq(eventRegistration.registrationId, registrationId));

  if (reg) revalidatePath(`/events/${reg.eventId}`);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/registrations.ts
git commit -m "feat(actions): add event registration server actions"
```

---

## Task 5: Middleware Update + Admin Nav

**Files:**
- Modify: `app/middleware.ts`
- Modify: `app/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Update `app/middleware.ts` to protect `/events/*`**

Replace the full file:

```typescript
// app/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute =
    path.startsWith("/members") || path.startsWith("/events");
  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/members", "/members/:path*", "/events", "/events/:path*"],
};
```

- [ ] **Step 2: Add Events nav link to `app/src/app/(admin)/layout.tsx`**

Replace the nav section (lines 16–30) — add Events link after the brand span:

```typescript
// app/src/app/(admin)/layout.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">JLY Church Admin</span>
          <Link
            href="/members"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Members
          </Link>
          <Link
            href="/events"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Events
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/middleware.ts app/src/app/"(admin)"/layout.tsx
git commit -m "feat(nav): protect /events routes and add Events nav link"
```

---

## Task 6: Staff Event List Page

**Files:**
- Create: `app/src/app/(admin)/events/page.tsx`

- [ ] **Step 1: Create `app/src/app/(admin)/events/page.tsx`**

```typescript
// app/src/app/(admin)/events/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, desc, inArray } from "drizzle-orm";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "upcoming";

  const statusValues =
    statusFilter === "past"
      ? (["COMPLETED", "CANCELLED"] as const)
      : (["SCHEDULED", "IN_PROGRESS"] as const);

  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(inArray(event.status, statusValues))
    .orderBy(desc(event.startsAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add event
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/events?status=upcoming"
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusFilter !== "past"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/events?status=past"
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusFilter === "past"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Past
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No events found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-3 pr-4 font-medium">Name</th>
              <th className="py-3 pr-4 font-medium">Type</th>
              <th className="py-3 pr-4 font-medium">Starts</th>
              <th className="py-3 pr-4 font-medium">Venue</th>
              <th className="py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.eventId}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/events/${e.eventId}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {e.name}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-gray-600">{e.eventTypeName}</td>
                <td className="py-3 pr-4 text-gray-600">
                  {new Date(e.startsAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 pr-4 text-gray-600">{e.venue ?? "—"}</td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.status === "SCHEDULED"
                        ? "bg-green-50 text-green-700"
                        : e.status === "IN_PROGRESS"
                        ? "bg-yellow-50 text-yellow-700"
                        : e.status === "CANCELLED"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-700"
                    }`}
                  >
                    {e.status}
                  </span>
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

- [ ] **Step 2: Start dev server and verify the page loads (requires event_type rows in DB)**

```bash
cd app && npm run dev
```
Open `http://localhost:3000/events` — confirm page renders without 500 errors. An empty table is fine if the DB has no events yet.

- [ ] **Step 3: Stop dev server, commit**

```bash
git add "app/src/app/(admin)/events/page.tsx"
git commit -m "feat(events): add staff event list page"
```

---

## Task 7: Staff Event Create Page

**Files:**
- Create: `app/src/app/(admin)/events/new/page.tsx`

- [ ] **Step 1: Create `app/src/app/(admin)/events/new/page.tsx`**

```typescript
// app/src/app/(admin)/events/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { eventType } from "@/schema/events";
import { createEvent } from "@/actions/events";
import { orderBy } from "drizzle-orm";

export default async function NewEventPage() {
  const eventTypes = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-900">
          ← Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add event</h1>
      </div>

      <form action={(fd) => void createEvent(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts at <span className="text-red-500">*</span>
            </label>
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ends at
            </label>
            <input
              name="endsAt"
              type="datetime-local"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected attendance
          </label>
          <input
            name="expectedAttendance"
            type="number"
            min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create event
          </button>
          <Link
            href="/events"
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

Note: `orderBy` is exported from `drizzle-orm` but the import above uses it directly on the table column — replace the query with:
```typescript
  const eventTypes = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);
```
(Remove the `orderBy` import from `drizzle-orm` — it's not needed; `.orderBy(eventType.name)` uses the column reference directly.)

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/src/app/(admin)/events/new/page.tsx"
git commit -m "feat(events): add staff create event page"
```

---

## Task 8: Staff Event Detail Page + Registrant List

**Files:**
- Create: `app/src/app/(admin)/events/[id]/page.tsx`

- [ ] **Step 1: Create `app/src/app/(admin)/events/[id]/page.tsx`**

```typescript
// app/src/app/(admin)/events/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType, eventRegistration } from "@/schema/events";
import { person, contactInfo } from "@/schema/core";
import { cancelEvent } from "@/actions/events";
import { updateRegistrationStatus } from "@/actions/registrations";
import { eq, and, desc } from "drizzle-orm";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  const registrants = await db
    .select({
      registrationId: eventRegistration.registrationId,
      status: eventRegistration.status,
      registeredAt: eventRegistration.registeredAt,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(eventRegistration)
    .innerJoin(person, eq(eventRegistration.personId, person.personId))
    .leftJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, person.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(eq(eventRegistration.eventId, eventId))
    .orderBy(desc(eventRegistration.registeredAt));

  const isCancellable =
    eventRow.status === "SCHEDULED" || eventRow.status === "IN_PROGRESS";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/events" className="text-sm text-gray-500 hover:text-gray-900">
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {eventRow.name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{eventRow.eventTypeName}</p>
        </div>
        <div className="flex gap-2">
          {isCancellable && (
            <>
              <Link
                href={`/events/${eventId}/edit`}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </Link>
              <form action={() => void cancelEvent(eventId)}>
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Cancel event
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Status</dt>
          <dd className="mt-1">{eventRow.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Venue</dt>
          <dd className="mt-1">{eventRow.venue ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Starts</dt>
          <dd className="mt-1">
            {new Date(eventRow.startsAt).toLocaleString("en-PH")}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Ends</dt>
          <dd className="mt-1">
            {eventRow.endsAt
              ? new Date(eventRow.endsAt).toLocaleString("en-PH")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Expected attendance</dt>
          <dd className="mt-1">{eventRow.expectedAttendance ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Public registration link</dt>
          <dd className="mt-1">
            <Link
              href={`/church/events/${eventId}`}
              className="text-blue-600 hover:underline text-xs"
              target="_blank"
            >
              /church/events/{eventId}
            </Link>
          </dd>
        </div>
      </dl>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Registrants ({registrants.length})
        </h2>
        {registrants.length === 0 ? (
          <p className="text-sm text-gray-500">No registrations yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Registered</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr key={r.registrationId} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {r.lastName}, {r.firstName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{r.email ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {new Date(r.registeredAt).toLocaleDateString("en-PH")}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "CONFIRMED"
                          ? "bg-green-50 text-green-700"
                          : r.status === "WAITLISTED"
                          ? "bg-yellow-50 text-yellow-700"
                          : r.status === "CANCELLED"
                          ? "bg-red-50 text-red-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {r.status !== "CONFIRMED" &&
                        r.status !== "CANCELLED" && (
                          <form
                            action={() =>
                              void updateRegistrationStatus(
                                r.registrationId,
                                "CONFIRMED"
                              )
                            }
                          >
                            <button
                              type="submit"
                              className="text-xs text-green-700 hover:underline"
                            >
                              Confirm
                            </button>
                          </form>
                        )}
                      {r.status !== "CANCELLED" && (
                        <form
                          action={() =>
                            void updateRegistrationStatus(
                              r.registrationId,
                              "CANCELLED"
                            )
                          }
                        >
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/src/app/(admin)/events/[id]/page.tsx"
git commit -m "feat(events): add staff event detail page with registrant list"
```

---

## Task 9: Staff Event Edit Page

**Files:**
- Create: `app/src/app/(admin)/events/[id]/edit/page.tsx`

- [ ] **Step 1: Create `app/src/app/(admin)/events/[id]/edit/page.tsx`**

```typescript
// app/src/app/(admin)/events/[id]/edit/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { updateEvent } from "@/actions/events";
import { eq } from "drizzle-orm";

function toDatetimeLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [[eventRow], eventTypes] = await Promise.all([
    db
      .select({
        eventId: event.eventId,
        name: event.name,
        eventTypeId: event.eventTypeId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venue: event.venue,
        expectedAttendance: event.expectedAttendance,
      })
      .from(event)
      .where(eq(event.eventId, eventId))
      .limit(1),
    db
      .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
      .from(eventType)
      .orderBy(eventType.name),
  ]);

  if (!eventRow) notFound();

  const action = updateEvent.bind(null, eventId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Event detail
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit event</h1>
      </div>

      <form action={(fd) => void action(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            defaultValue={eventRow.name}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event type <span className="text-red-500">*</span>
          </label>
          <select
            name="eventTypeId"
            defaultValue={eventRow.eventTypeId}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {eventTypes.map((et) => (
              <option key={et.eventTypeId} value={et.eventTypeId}>
                {et.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts at <span className="text-red-500">*</span>
            </label>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(new Date(eventRow.startsAt))}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ends at
            </label>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={
                eventRow.endsAt ? toDatetimeLocal(new Date(eventRow.endsAt)) : ""
              }
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
            defaultValue={eventRow.venue ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected attendance
          </label>
          <input
            name="expectedAttendance"
            type="number"
            min="1"
            defaultValue={eventRow.expectedAttendance ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save changes
          </button>
          <Link
            href={`/events/${eventId}`}
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

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/src/app/(admin)/events/[id]/edit/page.tsx"
git commit -m "feat(events): add staff edit event page"
```

---

## Task 10: Public Event Listing

**Files:**
- Create: `app/src/app/church/events/page.tsx`

- [ ] **Step 1: Create `app/src/app/church/events/page.tsx`**

```typescript
// app/src/app/church/events/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, inArray, asc } from "drizzle-orm";

export default async function PublicEventsPage() {
  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(inArray(event.status, ["SCHEDULED", "IN_PROGRESS"]))
    .orderBy(asc(event.startsAt))
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upcoming Events</h1>
        <p className="mt-2 text-gray-600">Join us at our upcoming church events.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No upcoming events at this time.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((e) => (
            <div
              key={e.eventId}
              className="rounded-lg border border-gray-200 bg-white p-5 space-y-2 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {e.name}
                  </h2>
                  <p className="text-sm text-gray-500">{e.eventTypeName}</p>
                </div>
                <Link
                  href={`/church/events/${e.eventId}`}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
              <div className="flex gap-4 text-sm text-gray-600">
                <span>
                  📅{" "}
                  {new Date(e.startsAt).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {e.venue && <span>📍 {e.venue}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/church/events/page.tsx
git commit -m "feat(public): add public event listing page at /church/events"
```

---

## Task 11: Public Event Detail + Registration Form

**Files:**
- Create: `app/src/app/church/events/[id]/page.tsx`

- [ ] **Step 1: Create `app/src/app/church/events/[id]/page.tsx`**

```typescript
// app/src/app/church/events/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { registerForEvent } from "@/actions/registrations";
import { eq } from "drizzle-orm";

export default async function PublicEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { registered?: string; error?: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  const isClosed =
    eventRow.status === "CANCELLED" || eventRow.status === "COMPLETED";

  const register = registerForEvent.bind(null, eventId);

  async function handleRegister(formData: FormData) {
    "use server";
    const result = await register(formData);
    const base = `/church/events/${eventId}`;
    const { redirect } = await import("next/navigation");
    if (result.success) {
      redirect(`${base}?registered=1`);
    } else {
      redirect(`${base}?error=${encodeURIComponent(result.error ?? "unknown")}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <Link
        href="/church/events"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← All events
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{eventRow.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{eventRow.eventTypeName}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Date &amp; time</dt>
          <dd className="mt-1">
            {new Date(eventRow.startsAt).toLocaleString("en-PH", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
        {eventRow.venue && (
          <div>
            <dt className="font-medium text-gray-500">Venue</dt>
            <dd className="mt-1">{eventRow.venue}</dd>
          </div>
        )}
      </dl>

      {searchParams.registered === "1" ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-5">
          <h2 className="text-lg font-semibold text-green-800">
            You&apos;re registered!
          </h2>
          <p className="mt-1 text-sm text-green-700">
            We look forward to seeing you at {eventRow.name}.
          </p>
        </div>
      ) : isClosed ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-5">
          <p className="text-sm text-gray-600">
            Registration for this event is closed.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Register for this event
          </h2>

          {searchParams.error === "already_registered" && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              You&apos;re already registered for this event.
            </div>
          )}

          {searchParams.error && searchParams.error !== "already_registered" && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              Something went wrong. Please try again.
            </div>
          )}

          <form action={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Register
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/church/events/
git commit -m "feat(public): add public event detail and registration form"
```

---

## Task 12: E2E Tests

**Files:**
- Create: `app/tests/e2e/events.spec.ts`

- [ ] **Step 1: Ensure Docker DB is running and dev server can start**

```bash
cd app && npm run dev &
sleep 5 && curl -s http://localhost:3000 | head -20
```
Expected: HTML response. Kill the dev server after confirming (`kill %1`).

- [ ] **Step 2: Create `app/tests/e2e/events.spec.ts`**

```typescript
// app/tests/e2e/events.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

async function staffLogin(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.goto("/login");
  await page.fill('input[name="email"]', STAFF_EMAIL);
  await page.fill('input[name="password"]', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/members");
}

test.describe("Staff event management", () => {
  test("staff can create an event and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events/new");
    await expect(page.getByRole("heading", { name: "Add event" })).toBeVisible();

    await page.fill('input[name="name"]', "E2E Test Service");
    // Select first available event type
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    await page.fill('input[name="startsAt"]', "2026-12-25T10:00");
    await page.fill('input[name="venue"]', "Main Hall");
    await page.getByRole("button", { name: "Create event" }).click();

    // Should redirect to event detail
    await expect(page).toHaveURL(/\/events\/\d+/);
    await expect(
      page.getByRole("heading", { name: "E2E Test Service" })
    ).toBeVisible();
  });

  test("staff can edit an event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");
    // Click first event in list
    const firstLink = page.locator("table tbody tr:first-child a").first();
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/events\/\d+\/edit/);

    await page.fill('input[name="name"]', "E2E Updated Event Name");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(/\/events\/\d+/);
    await expect(
      page.getByRole("heading", { name: "E2E Updated Event Name" })
    ).toBeVisible();
  });

  test("staff can cancel an event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");
    const firstLink = page.locator("table tbody tr:first-child a").first();
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    const cancelButton = page.getByRole("button", { name: "Cancel event" });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.getByText("CANCELLED")).toBeVisible();
    } else {
      // Event already cancelled from previous test run — skip
      test.skip();
    }
  });

  test("staff can see registrant after public registration", async ({
    page,
    context,
  }) => {
    await staffLogin(page);
    await page.goto("/events");

    // Find a SCHEDULED event
    const scheduledRow = page.locator('td:has-text("SCHEDULED")').first();
    await scheduledRow.waitFor({ timeout: 5000 }).catch(() => null);

    const eventLink = page
      .locator("table tbody tr")
      .filter({ has: page.locator('td:has-text("SCHEDULED")') })
      .first()
      .locator("a")
      .first();

    const href = await eventLink.getAttribute("href");
    if (!href) return test.skip();
    const eventId = href.split("/").pop();

    // Register via public form in new tab
    const publicPage = await context.newPage();
    await publicPage.goto(`/church/events/${eventId}`);
    await publicPage.fill('input[name="name"]', "E2E Registrant");
    await publicPage.fill('input[name="email"]', `e2e-${Date.now()}@test.com`);
    await publicPage.getByRole("button", { name: "Register" }).click();
    await expect(publicPage.getByText("You're registered!")).toBeVisible();
    await publicPage.close();

    // Refresh staff detail page
    await page.goto(`/events/${eventId}`);
    await expect(page.getByText("E2E Registrant")).toBeVisible();
  });

  test("staff can confirm a registrant", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const eventLink = page
      .locator("table tbody tr")
      .filter({ has: page.locator('td:has-text("SCHEDULED")') })
      .first()
      .locator("a")
      .first();

    const href = await eventLink.getAttribute("href");
    if (!href) return test.skip();

    await page.goto(href);
    const confirmButton = page
      .locator("table tbody tr")
      .filter({ has: page.locator("td:has-text('REGISTERED')") })
      .first()
      .getByRole("button", { name: "Confirm" });

    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await expect(page.getByText("CONFIRMED")).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe("Public event registration", () => {
  test("public user can register for an event", async ({ page }) => {
    // Find a scheduled event directly
    await page.goto("/church/events");
    const registerLink = page.getByRole("link", { name: "Register" }).first();

    if (!(await registerLink.isVisible())) {
      test.skip(); // No events in DB
      return;
    }

    await registerLink.click();
    await page.fill('input[name="name"]', "Public Test User");
    await page.fill(
      'input[name="email"]',
      `public-${Date.now()}@test.com`
    );
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("You're registered!")).toBeVisible();
  });

  test("duplicate registration shows friendly message", async ({ page }) => {
    await page.goto("/church/events");
    const registerLink = page.getByRole("link", { name: "Register" }).first();
    if (!(await registerLink.isVisible())) {
      test.skip();
      return;
    }

    const href = await registerLink.getAttribute("href");
    if (!href) return test.skip();

    const sharedEmail = `dup-${Date.now()}@test.com`;

    // First registration
    await page.goto(href);
    await page.fill('input[name="name"]', "Dup Test User");
    await page.fill('input[name="email"]', sharedEmail);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("You're registered!")).toBeVisible();

    // Second registration with same email
    await page.goto(href);
    await page.fill('input[name="name"]', "Dup Test User");
    await page.fill('input[name="email"]', sharedEmail);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(
      page.getByText("You're already registered for this event.")
    ).toBeVisible();
  });
});
```

- [ ] **Step 3: Run E2E tests**

```bash
cd app && npx playwright test tests/e2e/events.spec.ts --reporter=list
```

Expected: all tests pass (some may skip if DB has no events — that's expected on a fresh DB). Fix any failures before committing.

If `selectOption` fails on the event type dropdown (no event types in DB seed), the create-event test will fail. This is a DB seed issue, not a code issue. To add a seed event type for testing:

```sql
-- Run once in psql or via docker exec
INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular') ON CONFLICT DO NOTHING;
INSERT INTO events.event_type (code, name, category_code) VALUES ('SUNDAY_SERVICE', 'Sunday Service', 'REGULAR') ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/events.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for events management and public registration"
```

---

## Task 13: Final Build Check

**Files:**
- No new files — verify everything compiles and tests pass

- [ ] **Step 1: Run full unit test suite**

```bash
cd app && npx vitest run
```
Expected: all tests pass including new event schema tests.

- [ ] **Step 2: Run production build**

```bash
cd app && npm run build
```
Expected: build succeeds with no TypeScript errors or missing module errors.

- [ ] **Step 3: If build fails, fix errors, then commit**

Common issues:
- Missing `import Link from "next/link"` — add it
- `orderBy` import collision in `new/page.tsx` — remove the unused `orderBy` import from `drizzle-orm` (the column reference is sufficient)
- `// eslint-disable` lines needed for Drizzle enum `as any` casts — already included

After fixing:
```bash
git add -p  # stage only the fix
git commit -m "fix(events): resolve build errors from final check"
```

- [ ] **Step 4: Final commit if no fixes were needed**

```bash
git log --oneline -10
```
Verify all Plan 6a commits are present.
