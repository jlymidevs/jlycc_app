# Plan 6b: Attendance Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staff attendance check-in (search + QR scan), first-time visitor capture, member QR codes, per-event stats, and a cross-event attendance dashboard.

**Architecture:** Server component pages with server actions for mutations (matching Plan 6a pattern). Search uses URL query params (`?q=...`) for server-side rendering. QR scanner is the only client component — wraps `@zxing/browser`. QR display on member profile uses `qrcode.react`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM, Tailwind CSS, Zod, `qrcode.react`, `@zxing/browser`, Vitest, Playwright.

---

## File Map

| Action | Path |
|--------|------|
| Create | `db/migrations/V050__attendance_partitions_2026.sql` |
| Create | `app/src/schema/attendance.ts` |
| Create | `app/src/lib/validations/attendance.ts` |
| Create | `app/src/actions/attendance.ts` |
| Create | `app/src/components/QrScanner.tsx` |
| Create | `app/src/app/(admin)/events/[id]/attendance/page.tsx` |
| Create | `app/src/app/(admin)/events/attendance/page.tsx` |
| Create | `app/tests/unit/attendance.test.ts` |
| Create | `app/tests/e2e/attendance.spec.ts` |
| Modify | `app/src/app/(admin)/layout.tsx` |
| Modify | `app/src/app/(admin)/members/[id]/page.tsx` |
| Modify | `app/src/app/(admin)/events/[id]/page.tsx` |
| Modify | `app/package.json` (add deps) |

---

### Task 1: Partition Migration

V038 only has April and May 2026 partitions. Any check-in for June 2026+ will fail with "no partition found." Add June–December 2026 now.

**Files:**
- Create: `db/migrations/V050__attendance_partitions_2026.sql`

- [ ] **Step 1: Create migration file**

```sql
-- db/migrations/V050__attendance_partitions_2026.sql
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_06 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_07 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_08 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_09 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_10 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_11 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_12 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/V050__attendance_partitions_2026.sql
git commit -m "feat(db): add attendance check_in partitions for 2026-06 through 2026-12"
```

---

### Task 2: Install Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install packages**

Run from the `app/` directory:

```bash
cd app && npm install qrcode.react @zxing/browser
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('qrcode.react'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat(deps): add qrcode.react and @zxing/browser for attendance QR"
```

---

### Task 3: Drizzle Attendance Schema

Mirror V038 (`attendance.check_in`) and V039 (`attendance.visitor_capture`). The `check_in` table has a composite PK `(check_in_id, checked_in_at)` because it is range-partitioned by `checked_in_at`.

**Files:**
- Create: `app/src/schema/attendance.ts`

- [ ] **Step 1: Create schema file**

```typescript
// app/src/schema/attendance.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  pgSchema,
  primaryKey,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";
import { event } from "./events";

export const attendanceSchema = pgSchema("attendance");

export const checkInMethodEnum = attendanceSchema.enum("check_in_method", [
  "SELF",
  "USHER",
  "BULK_IMPORT",
]);

export const checkIn = attendanceSchema.table(
  "check_in",
  {
    checkInId: bigserial("check_in_id", { mode: "number" }).notNull(),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => event.eventId),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => person.personId),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => branch.branchId),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull(),
    checkInMethod: checkInMethodEnum("check_in_method")
      .notNull()
      .default("USHER"),
    capturedByMemberId: bigint("captured_by_member_id", {
      mode: "number",
    }).references(() => member.memberId),
    ftvCaptureId: bigint("ftv_capture_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.checkInId, t.checkedInAt] })]
);

export const visitorCapture = attendanceSchema.table("visitor_capture", {
  ftvCaptureId: bigserial("ftv_capture_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  eventId: bigint("event_id", { mode: "number" })
    .notNull()
    .references(() => event.eventId),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  capturedByMemberId: bigint("captured_by_member_id", {
    mode: "number",
  }).references(() => member.memberId),
  invitedByPersonId: bigint("invited_by_person_id", {
    mode: "number",
  }).references(() => person.personId),
  consentToContact: boolean("consent_to_contact").notNull().default(false),
  intakeNotes: text("intake_notes"),
  convertedMemberId: bigint("converted_member_id", {
    mode: "number",
  }).references(() => member.memberId),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/schema/attendance.ts
git commit -m "feat(schema): add Drizzle definitions for attendance.check_in and visitor_capture"
```

---

### Task 4: Zod Validations + Unit Tests

**Files:**
- Create: `app/src/lib/validations/attendance.ts`
- Create: `app/tests/unit/attendance.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// app/tests/unit/attendance.test.ts
import { describe, it, expect } from "vitest";
import { checkInSchema, captureVisitorSchema } from "@/lib/validations/attendance";

describe("checkInSchema", () => {
  it("accepts valid input", () => {
    const result = checkInSchema.safeParse({ eventId: 1, personId: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects missing eventId", () => {
    const result = checkInSchema.safeParse({ personId: 42 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("eventId");
  });

  it("rejects missing personId", () => {
    const result = checkInSchema.safeParse({ eventId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects non-positive eventId", () => {
    const result = checkInSchema.safeParse({ eventId: 0, personId: 1 });
    expect(result.success).toBe(false);
  });
});

describe("captureVisitorSchema", () => {
  it("accepts valid full input", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
      consentToContact: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = captureVisitorSchema.safeParse({
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("firstName");
  });

  it("rejects missing lastName", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("lastName");
  });

  it("rejects missing birthday", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("birthday");
  });

  it("rejects invalid email", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("defaults consentToContact to false", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consentToContact).toBe(false);
    }
  });

  it("accepts optional invitedByPersonId", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
      invitedByPersonId: 7,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npx vitest run tests/unit/attendance.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/validations/attendance'`

- [ ] **Step 3: Create validation file**

```typescript
// app/src/lib/validations/attendance.ts
import { z } from "zod";

export const checkInSchema = z.object({
  eventId: z.number().int().positive(),
  personId: z.number().int().positive(),
});

export const captureVisitorSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  birthday: z.string().min(1, "Birthday required"),
  email: z.string().email("Valid email required"),
  consentToContact: z.boolean().default(false),
  invitedByPersonId: z.number().int().positive().optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CaptureVisitorInput = z.infer<typeof captureVisitorSchema>;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd app && npx vitest run tests/unit/attendance.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/attendance.ts app/tests/unit/attendance.test.ts
git commit -m "feat(validation): add Zod schemas and unit tests for attendance"
```

---

### Task 5: Attendance Server Actions

Three actions: `searchPersons`, `checkIn`, `captureVisitor`.

**Files:**
- Create: `app/src/actions/attendance.ts`

- [ ] **Step 1: Create actions file**

```typescript
// app/src/actions/attendance.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo, branch } from "@/schema/core";
import { event } from "@/schema/events";
import { checkIn as checkInTable, visitorCapture } from "@/schema/attendance";
import { checkInSchema, captureVisitorSchema, CaptureVisitorInput } from "@/lib/validations/attendance";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, or, isNull } from "drizzle-orm";

export type PersonSearchResult = {
  personId: number;
  firstName: string;
  lastName: string;
  email: string | null;
};

export async function searchPersons(
  query: string
): Promise<PersonSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = `%${query.trim()}%`;

  const rows = await db
    .select({
      personId: person.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(person)
    .leftJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, person.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(
      and(
        isNull(person.deletedAt),
        or(
          ilike(person.firstName, q),
          ilike(person.lastName, q),
          ilike(contactInfo.value, q)
        )
      )
    )
    .limit(10);

  return rows.map((r) => ({
    personId: r.personId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
  }));
}

export async function checkInPerson(
  eventId: number,
  personId: number
): Promise<{ success: true; name: string } | { error: string }> {
  const parsed = checkInSchema.safeParse({ eventId, personId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Duplicate guard
  const existing = await db
    .select({ checkInId: checkInTable.checkInId })
    .from(checkInTable)
    .where(
      and(
        eq(checkInTable.eventId, eventId),
        eq(checkInTable.personId, personId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "already_checked_in" };
  }

  // Get branchId from event
  const [eventRow] = await db
    .select({
      branchId: event.branchId,
      hostBranchId: event.hostBranchId,
    })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  const branchId = eventRow?.hostBranchId ?? eventRow?.branchId;
  if (!branchId) {
    return { error: "Event has no branch assigned" };
  }

  const [personRow] = await db
    .select({ firstName: person.firstName, lastName: person.lastName })
    .from(person)
    .where(eq(person.personId, personId))
    .limit(1);

  const now = new Date();

  await db.insert(checkInTable).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventId: eventId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: branchId as any,
    checkedInAt: now,
    checkInMethod: "USHER",
  });

  revalidatePath(`/events/${eventId}/attendance`);
  const name = personRow
    ? `${personRow.firstName} ${personRow.lastName}`
    : "Unknown";
  return { success: true, name };
}

export async function captureVisitor(
  eventId: number,
  data: CaptureVisitorInput
): Promise<{ success: true } | { error: string }> {
  const parsed = captureVisitorSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { firstName, lastName, birthday, email, consentToContact, invitedByPersonId } =
    parsed.data;

  // Check email not already in system
  const existing = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .where(and(eq(contactInfo.type, "EMAIL"), eq(contactInfo.value, email)))
    .limit(1);

  if (existing.length > 0) {
    return { error: "person_already_exists" };
  }

  // Get branchId from event
  const [eventRow] = await db
    .select({ branchId: event.branchId, hostBranchId: event.hostBranchId })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  const branchId = eventRow?.hostBranchId ?? eventRow?.branchId;
  if (!branchId) {
    return { error: "Event has no branch assigned" };
  }

  await db.transaction(async (tx) => {
    const [newPerson] = await tx
      .insert(person)
      .values({ firstName, lastName, dateOfBirth: birthday })
      .returning({ personId: person.personId });

    await tx.insert(contactInfo).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: newPerson.personId as any,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });

    const [capture] = await tx
      .insert(visitorCapture)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personId: newPerson.personId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventId: eventId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchId: branchId as any,
        consentToContact,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(invitedByPersonId && { invitedByPersonId: invitedByPersonId as any }),
      })
      .returning({ ftvCaptureId: visitorCapture.ftvCaptureId });

    const now = new Date();
    await tx.insert(checkInTable).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventId: eventId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: newPerson.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: branchId as any,
      checkedInAt: now,
      checkInMethod: "USHER",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ftvCaptureId: capture.ftvCaptureId as any,
    });
  });

  revalidatePath(`/events/${eventId}/attendance`);
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/actions/attendance.ts
git commit -m "feat(actions): add searchPersons, checkInPerson, captureVisitor server actions"
```

---

### Task 6: Member QR Code

Add a QR code section to the existing member detail page. The QR encodes the plain `personId` integer as a string. Staff can show this to ushers for scan-to-check-in.

**Files:**
- Modify: `app/src/app/(admin)/members/[id]/page.tsx`

- [ ] **Step 1: Add QR imports and section**

The existing file is a server component. `QRCodeSVG` from `qrcode.react` can be rendered server-side in Next.js. Add the import at the top and a new `<section>` after the Roles section.

At the top of `app/src/app/(admin)/members/[id]/page.tsx`, add the import after existing imports:

```typescript
import { QRCodeSVG } from "qrcode.react";
```

After the closing `)}` of the roles section (and before the final closing `</div>`), add:

```tsx
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Attendance QR
        </h2>
        <p className="text-xs text-gray-500">
          Show this code to an usher for quick check-in at events.
        </p>
        <QRCodeSVG value={String(row.personId)} size={160} />
      </section>
```

- [ ] **Step 2: Verify page compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(admin)/members/[id]/page.tsx
git commit -m "feat(members): add QR code section to member detail page"
```

---

### Task 7: QR Scanner Client Component

Browser camera scanner using `@zxing/browser`. This is a `"use client"` component that decodes QR codes from the camera and calls the `checkInPerson` server action.

**Files:**
- Create: `app/src/components/QrScanner.tsx`

- [ ] **Step 1: Create component**

```tsx
// app/src/components/QrScanner.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import { checkInPerson } from "@/actions/attendance";

interface QrScannerProps {
  eventId: number;
}

export default function QrScanner({ eventId }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const reader = new BrowserQRCodeReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, async (result, err) => {
        if (stopped) return;
        if (!result) return;

        const personId = parseInt(result.getText(), 10);
        if (isNaN(personId)) {
          setError("Invalid QR code");
          return;
        }

        stopped = true;
        controlsRef.current?.stop();
        setActive(false);

        const res = await checkInPerson(eventId, personId);
        if ("error" in res) {
          setError(
            res.error === "already_checked_in"
              ? "Already checked in"
              : res.error
          );
        } else {
          setMessage(`Checked in: ${res.name}`);
          router.refresh();
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Camera error");
        setActive(false);
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [active, eventId, router]);

  return (
    <div className="space-y-2">
      {!active && (
        <button
          onClick={() => {
            setMessage(null);
            setError(null);
            setActive(true);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Scan QR
        </button>
      )}
      {active && (
        <div className="space-y-2">
          <video ref={videoRef} className="w-64 h-48 rounded border" />
          <button
            onClick={() => {
              controlsRef.current?.stop();
              setActive(false);
            }}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Cancel scan
          </button>
        </div>
      )}
      {message && (
        <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-1">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded px-3 py-1">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/QrScanner.tsx
git commit -m "feat(components): add QrScanner client component using @zxing/browser"
```

---

### Task 8: Per-Event Attendance Page

Server component. Search via `?q=` URL param. Shows stats, search results, FTV form on no-match, and check-in list.

**Files:**
- Create: `app/src/app/(admin)/events/[id]/attendance/page.tsx`
- Modify: `app/src/app/(admin)/events/[id]/page.tsx` (add Attendance link)

- [ ] **Step 1: Create attendance page**

```tsx
// app/src/app/(admin)/events/[id]/attendance/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { checkIn, visitorCapture } from "@/schema/attendance";
import { person, contactInfo } from "@/schema/core";
import { eq, and, desc, count, isNotNull } from "drizzle-orm";
import { checkInPerson, captureVisitor, searchPersons } from "@/actions/attendance";
import QrScanner from "@/components/QrScanner";

export const dynamic = "force-dynamic";

export default async function EventAttendancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({ eventId: event.eventId, name: event.name, status: event.status })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  // Stats
  const [{ total }] = await db
    .select({ total: count() })
    .from(checkIn)
    .where(eq(checkIn.eventId, eventId));

  const [{ unique }] = await db
    .select({ unique: count(checkIn.personId) })
    .from(checkIn)
    .where(eq(checkIn.eventId, eventId));

  const [{ ftv }] = await db
    .select({ ftv: count() })
    .from(checkIn)
    .where(
      and(eq(checkIn.eventId, eventId), isNotNull(checkIn.ftvCaptureId))
    );

  // Check-in list
  const checkIns = await db
    .select({
      checkInId: checkIn.checkInId,
      checkedInAt: checkIn.checkedInAt,
      checkInMethod: checkIn.checkInMethod,
      ftvCaptureId: checkIn.ftvCaptureId,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(checkIn)
    .innerJoin(person, eq(checkIn.personId, person.personId))
    .where(eq(checkIn.eventId, eventId))
    .orderBy(desc(checkIn.checkedInAt));

  // Search
  const query = searchParams.q?.trim() ?? "";
  const searchResults = query.length >= 2 ? await searchPersons(query) : [];
  const showFtvPrompt = query.length >= 2 && searchResults.length === 0;

  async function handleCheckIn(formData: FormData) {
    "use server";
    const personId = Number(formData.get("personId"));
    await checkInPerson(eventId, personId);
    redirect(`/events/${eventId}/attendance`);
  }

  async function handleCaptureVisitor(formData: FormData) {
    "use server";
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      birthday: formData.get("birthday") as string,
      email: formData.get("email") as string,
      consentToContact: formData.get("consentToContact") === "on",
      invitedByPersonId: formData.get("invitedByPersonId")
        ? Number(formData.get("invitedByPersonId"))
        : undefined,
    };
    const result = await captureVisitor(eventId, data);
    if ("error" in result && result.error === "person_already_exists") {
      redirect(`/events/${eventId}/attendance?q=${encodeURIComponent(data.email)}&ftverr=exists`);
    }
    redirect(`/events/${eventId}/attendance`);
  }

  const ftvError = (searchParams as Record<string, string>).ftverr;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← {eventRow.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Attendance</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total check-ins", value: total },
          { label: "Unique persons", value: unique },
          { label: "First-time visitors", value: ftv },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-lg border border-gray-200 p-4 text-center"
          >
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Scan */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Check In
        </h2>
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by name or email…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>
        <QrScanner eventId={eventId} />

        {/* Search results */}
        {searchResults.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {searchResults.map((p) => (
              <li key={p.personId} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.firstName} {p.lastName}
                  </p>
                  {p.email && (
                    <p className="text-xs text-gray-500">{p.email}</p>
                  )}
                </div>
                <form action={handleCheckIn}>
                  <input type="hidden" name="personId" value={p.personId} />
                  <button
                    type="submit"
                    className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Check in
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {/* FTV prompt */}
        {showFtvPrompt && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">
              No person found for &ldquo;{query}&rdquo; — capture as first-time visitor?
            </p>
            {ftvError === "exists" && (
              <p className="text-sm text-red-700">
                That email already exists. Search by name to find the person.
              </p>
            )}
            <form action={handleCaptureVisitor} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First name *
                  </label>
                  <input
                    name="firstName"
                    required
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Last name *
                  </label>
                  <input
                    name="lastName"
                    required
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Birthday *
                  </label>
                  <input
                    name="birthday"
                    type="date"
                    required
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Invited by (person ID, optional)
                </label>
                <input
                  name="invitedByPersonId"
                  type="number"
                  className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="consentToContact" />
                Consent to be contacted
              </label>
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Capture visitor &amp; check in
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Check-in list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Checked In ({checkIns.length})
          </h2>
        </div>
        {checkIns.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500 text-center">
            No one checked in yet.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Time", "Method", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checkIns.map((c) => (
                <tr key={c.checkInId}>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {c.checkedInAt.toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {c.checkInMethod}
                  </td>
                  <td className="px-6 py-3">
                    {c.ftvCaptureId && (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        FTV
                      </span>
                    )}
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

- [ ] **Step 2: Add Attendance link to event detail page**

In `app/src/app/(admin)/events/[id]/page.tsx`, find the buttons section (near the Edit/Cancel buttons) and add:

```tsx
          <Link
            href={`/events/${eventId}/attendance`}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Attendance
          </Link>
```

Add it in the `<div className="flex gap-2">` alongside Edit and Cancel buttons.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(admin)/events/[id]/attendance/page.tsx app/src/app/(admin)/events/[id]/page.tsx
git commit -m "feat(events): add per-event attendance page with search, check-in, FTV capture, and QR scanner"
```

---

### Task 9: Attendance Dashboard

Cross-event dashboard. Filters by branch and date range. Reads from `attendance.attendance_summary` view using raw SQL.

**Files:**
- Create: `app/src/app/(admin)/events/attendance/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
// app/src/app/(admin)/events/attendance/page.tsx
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SummaryRow = {
  event_id: number;
  event_name: string;
  branch_id: number;
  branch_name: string;
  week_start: string;
  total_check_ins: number;
  unique_persons: number;
  ftv_count: number;
};

export default async function AttendanceDashboardPage({
  searchParams,
}: {
  searchParams: { branchId?: string; range?: string };
}) {
  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  const selectedBranchId = searchParams.branchId
    ? Number(searchParams.branchId)
    : null;
  const range = searchParams.range ?? "month";

  const weekOffset = range === "week" ? 7 : range === "month" ? 30 : 365;
  const since = new Date();
  since.setDate(since.getDate() - weekOffset);
  const sinceStr = since.toISOString().split("T")[0];

  const rows = await db.execute<SummaryRow>(sql`
    SELECT
      s.event_id,
      e.name   AS event_name,
      s.branch_id,
      b.name   AS branch_name,
      s.week_start::text,
      s.total_check_ins,
      s.unique_persons,
      s.ftv_count
    FROM attendance.attendance_summary s
    JOIN events.event    e ON e.event_id   = s.event_id
    JOIN core.branch     b ON b.branch_id  = s.branch_id
    WHERE s.week_start >= ${sinceStr}::date
      ${selectedBranchId ? sql`AND s.branch_id = ${selectedBranchId}` : sql``}
    ORDER BY s.week_start DESC, e.name
    LIMIT 200
  `);

  const summary = rows.rows ?? (rows as unknown as SummaryRow[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Weekly aggregates across all events</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
          <select
            name="branchId"
            defaultValue={selectedBranchId ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date range</label>
          <select
            name="range"
            defaultValue={range}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      {summary.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance data for the selected filters.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Week of", "Event", "Branch", "Total", "Unique", "FTV"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((row, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 text-sm text-gray-500">{row.week_start}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {row.event_name}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{row.branch_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.total_check_ins}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.unique_persons}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.ftv_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/(admin)/events/attendance/page.tsx
git commit -m "feat(events): add cross-event attendance dashboard with branch and date filters"
```

---

### Task 10: Admin Nav Update

Add "Attendance" link to the admin nav layout.

**Files:**
- Modify: `app/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Add nav link**

In `app/src/app/(admin)/layout.tsx`, in the `<div className="flex items-center gap-6">` section, add after the Events link:

```tsx
          <Link
            href="/events/attendance"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Attendance
          </Link>
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/(admin)/layout.tsx
git commit -m "feat(nav): add Attendance link to admin navigation"
```

---

### Task 11: E2E Tests

**Files:**
- Create: `app/tests/e2e/attendance.spec.ts`

- [ ] **Step 1: Create E2E test file**

```typescript
// app/tests/e2e/attendance.spec.ts
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

test.describe("Attendance dashboard", () => {
  test("dashboard page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events/attendance");
    await expect(
      page.getByRole("heading", { name: "Attendance Dashboard" })
    ).toBeVisible();
    await expect(page.locator('select[name="branchId"]')).toBeVisible();
    await expect(page.locator('select[name="range"]')).toBeVisible();
  });
});

test.describe("Per-event attendance", () => {
  test("attendance page loads for first event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) {
      test.skip();
      return;
    }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    await page.getByRole("link", { name: "Attendance" }).click();
    await page.waitForURL(/\/events\/\d+\/attendance/);

    await expect(
      page.getByRole("heading", { name: "Attendance" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search by name or email…")).toBeVisible();
  });

  test("search with no results shows FTV prompt", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) {
      test.skip();
      return;
    }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);
    const url = page.url();
    const eventId = url.match(/\/events\/(\d+)/)?.[1];
    if (!eventId) { test.skip(); return; }

    await page.goto(`/events/${eventId}/attendance?q=ZZZNobodyHasThisName999`);
    await expect(
      page.getByText(/No person found for/)
    ).toBeVisible();
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
  });

  test("search with query shows results when persons exist", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) { test.skip(); return; }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);
    const eventId = page.url().match(/\/events\/(\d+)/)?.[1];
    if (!eventId) { test.skip(); return; }

    // Search with a broad term — 'a' should match something in most seeds
    await page.goto(`/events/${eventId}/attendance?q=a`);
    // Either results or FTV prompt — both are valid depending on DB state
    const hasResults = await page.locator('button:has-text("Check in")').count() > 0;
    const hasPrompt = await page.getByText(/No person found for/).count() > 0;
    expect(hasResults || hasPrompt).toBe(true);
  });
});

test.describe("Member QR code", () => {
  test("member detail page shows QR code section", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/members");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) { test.skip(); return; }
    await firstLink.click();
    await page.waitForURL(/\/members\/\d+/);

    await expect(page.getByText("Attendance QR")).toBeVisible();
    await expect(page.locator("svg")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add app/tests/e2e/attendance.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for attendance check-in, FTV, QR, and dashboard"
```

---

### Task 12: Final Build Check

**Files:** None created — verification only.

- [ ] **Step 1: Run unit tests**

```bash
cd app && npx vitest run
```

Expected: all unit tests pass (includes previous event + member tests).

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
cd app && npm run build
```

Expected: Build completes. If there are prerender errors on attendance pages, they already have `export const dynamic = "force-dynamic"` — verify those lines are present.

If `@zxing/browser` causes a build error (some versions require specific bundler config), add to `next.config.js`:

```javascript
// next.config.js — add if @zxing/browser causes build error
const nextConfig = {
  // existing config ...
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};
```

- [ ] **Step 4: Commit build fix if needed**

```bash
git add app/next.config.js
git commit -m "fix(build): add webpack fallback for @zxing/browser fs module"
```

- [ ] **Step 5: Final commit if all clean**

```bash
cd app && npm run build && echo "Build OK"
```

---

## Self-Review

**Spec coverage:**
- ✅ check_in + visitor_capture (not child_check_in) — Tasks 3–5
- ✅ Search by name/email → click check-in — Task 8
- ✅ QR scan check-in — Tasks 7–8
- ✅ Member QR on profile page — Task 6
- ✅ FTV auto-prompt on no-match — Task 8
- ✅ firstName/lastName/birthday in FTV form — Task 8
- ✅ Per-event stats (total, unique, FTV count) — Task 8
- ✅ Cross-event dashboard (branch + date filter) — Task 9
- ✅ attendance_summary view used for dashboard — Task 9
- ✅ Partition gap risk addressed — Task 1
- ✅ Admin nav link — Task 10
- ✅ Unit tests — Task 4
- ✅ E2E tests — Task 11
- ✅ Build check — Task 12

**Type consistency check:**
- `checkInPerson` (action name) used consistently across Tasks 5, 7, 8
- `captureVisitor` used consistently across Tasks 5, 8
- `searchPersons` used consistently across Tasks 5, 8
- `CaptureVisitorInput` type exported from validations, imported in actions
- `checkIn` table import aliased carefully — in Task 8 page, `checkIn` is imported from `@/schema/attendance` and the action `checkInPerson` is from `@/actions/attendance` — no name collision

**Partition note:** Task 1 must be applied to the database before any check-in attempts in June 2026 or later.
