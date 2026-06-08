# JLY Church App — Plan 6b: Attendance Tracking Design

## Goal

Add staff-facing attendance check-in for events, first-time visitor (FTV) capture, member QR codes, and a cross-event attendance dashboard. Build on existing `attendance` schema (V038–V041) — no new migrations needed.

## Scope

**In scope (Plan 6b):**
- Per-event attendance page: search members, one-click check-in, QR scan check-in
- FTV auto-prompt: no-match search → inline visitor capture form
- Member QR code on member detail page
- Cross-event attendance dashboard with branch + date filters
- Per-event stats strip (total, unique, FTV count)

**Out of scope:**
- Child check-in / pickup codes (Plan 6d)
- Self check-in (SELF method) — staff-only for now
- Bulk import (BULK_IMPORT method)
- Push notifications / reminders

---

## Architecture

### New Files

```
app/src/
├── schema/
│   └── attendance.ts                    # Drizzle: checkIn, visitorCapture
├── lib/validations/
│   └── attendance.ts                    # Zod: checkInSchema, captureVisitorSchema
├── actions/
│   └── attendance.ts                    # checkIn, captureVisitor, searchPersons
└── app/(admin)/
    └── events/
        ├── attendance/
        │   └── page.tsx                 # Cross-event dashboard
        └── [id]/
            └── attendance/
                └── page.tsx             # Per-event attendance page
```

### Modified Files

```
app/src/app/(admin)/
├── layout.tsx                           # Add Attendance link to nav
└── members/[id]/
    └── page.tsx                         # Add QR code section
```

### No New Migrations

All tables already exist: `attendance.check_in` (V038), `attendance.visitor_capture` (V039), `attendance.child_check_in` (V040, not used), `attendance.attendance_summary` view (V041).

---

## Data Flow

### Check-in Flow

1. Staff opens `/events/[id]/attendance`
2. Types name or email → `searchPersons(query)` server action → queries `core.person` joined with `core.contact_info` → returns matches (personId, name, email)
3. Clicks person → `checkIn(eventId, personId)` server action:
   - Duplicate guard: check existing `attendance.check_in` for same eventId + personId → return `{ error: "already_checked_in" }` if found
   - Insert `attendance.check_in` with method=USHER, captured_by_member_id from session, branch_id from event's hostBranchId
4. Row appears in live check-in list below search

### FTV Auto-Prompt Flow

1. Search returns 0 results → "Not found — capture as visitor?" prompt appears
2. Staff fills: first name, last name, birthday (date), email, consent_to_contact (checkbox, default false), invited_by (optional person search)
3. `captureVisitor(eventId, data)` server action in a single transaction:
   - Insert `core.person` (firstName, lastName, birthday)
   - Insert `core.contact_info` (type=EMAIL)
   - Insert `attendance.visitor_capture` (captured_by_member_id from session, branch_id from event)
   - Insert `attendance.check_in` with ftv_capture_id linked
4. Person appears in check-in list with FTV badge

### QR Scan Flow

1. Staff clicks "Scan QR" on attendance page → client component opens browser camera via `getUserMedia`
2. QR encodes plain `person_id` integer (staff-only authenticated page — no signing needed)
3. Decode → same `checkIn(eventId, personId)` path as manual check-in
4. Member QR displayed on `/members/[id]` using `qrcode.react`

---

## Pages

### Per-Event Attendance Page (`/events/[id]/attendance`)

- Stats strip at top: total check-ins, unique persons, FTV count — live count query against `attendance.check_in` for that eventId
- Search input: name or email, results list with click-to-check-in
- "Scan QR" button: opens camera scanner (client component)
- FTV prompt: shown when search returns 0 results
- Check-in list: name, checked_in_at, method badge (USHER/SELF/BULK), FTV badge if ftv_capture_id set
- `export const dynamic = "force-dynamic"`

### Cross-Event Dashboard (`/events/attendance`)

- Branch filter (dropdown, all branches from `core.branch`)
- Date range filter (this week / this month / custom)
- Queries `attendance.attendance_summary` view — weekly aggregates by event + branch
- Table: week_start, event name, branch, total_check_ins, unique_persons, ftv_count
- `export const dynamic = "force-dynamic"`
- Nav link added to admin layout

### Member Detail Page (modified)

- QR code section added: displays QR encoding `person_id` using `qrcode.react`
- "Download QR" button for printing

---

## Drizzle Schema (`schema/attendance.ts`)

Mirrors V038–V039:

```typescript
export const attendanceSchema = pgSchema("attendance");
export const checkInMethodEnum = attendanceSchema.enum("check_in_method", ["SELF", "USHER", "BULK_IMPORT"]);

export const checkIn = attendanceSchema.table("check_in", {
  checkInId: bigserial("check_in_id", { mode: "bigint" }),
  eventId: bigint("event_id", { mode: "bigint" }).notNull().references(() => event.eventId),
  personId: bigint("person_id", { mode: "bigint" }).notNull().references(() => person.personId),
  branchId: bigint("branch_id", { mode: "bigint" }).notNull().references(() => branch.branchId),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull(),
  checkInMethod: checkInMethodEnum("check_in_method").notNull().default("USHER"),
  capturedByMemberId: bigint("captured_by_member_id", { mode: "bigint" }),
  ftvCaptureId: bigint("ftv_capture_id", { mode: "bigint" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.checkInId, t.checkedInAt] })]);

export const visitorCapture = attendanceSchema.table("visitor_capture", {
  ftvCaptureId: bigserial("ftv_capture_id", { mode: "bigint" }).primaryKey(),
  personId: bigint("person_id", { mode: "bigint" }).notNull().references(() => person.personId),
  eventId: bigint("event_id", { mode: "bigint" }).notNull().references(() => event.eventId),
  branchId: bigint("branch_id", { mode: "bigint" }).notNull().references(() => branch.branchId),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  capturedByMemberId: bigint("captured_by_member_id", { mode: "bigint" }),
  invitedByPersonId: bigint("invited_by_person_id", { mode: "bigint" }),
  consentToContact: boolean("consent_to_contact").notNull().default(false),
  intakeNotes: text("intake_notes"),
  convertedMemberId: bigint("converted_member_id", { mode: "bigint" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Note: `check_in` is partitioned in the DB. Drizzle queries work against the parent table — no special handling needed.

---

## Server Actions (`actions/attendance.ts`)

- `searchPersons(query: string)` — returns `{ personId, firstName, lastName, email }[]`
- `checkIn(eventId: number, personId: number)` — returns `{ success: true } | { error: "already_checked_in" | string }`
- `captureVisitor(eventId: number, data: CaptureVisitorInput)` — transaction: person + contact_info + visitor_capture + check_in

---

## Zod Schemas (`lib/validations/attendance.ts`)

```typescript
export const checkInSchema = z.object({
  eventId: z.number().int().positive(),
  personId: z.number().int().positive(),
});

export const captureVisitorSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  birthday: z.string().min(1, "Birthday required"), // ISO date string YYYY-MM-DD
  email: z.string().email("Valid email required"),
  consentToContact: z.boolean().default(false),
  invitedByPersonId: z.number().int().positive().optional(),
});
```

---

## Dependencies

- `qrcode.react` — QR code display (member profile)
- `@zxing/browser` — QR code scanning (camera, client component)

---

## Testing

### Unit Tests (`tests/unit/attendance.test.ts`)

- `checkInSchema`: valid input, missing eventId, missing personId
- `captureVisitorSchema`: valid FTV, invalid email, firstName required, lastName required, birthday required, consent defaults false

### E2E Tests (`tests/e2e/attendance.spec.ts`)

- Staff opens event attendance page → sees search input + stats strip
- Search returns member → click check-in → appears in list
- Duplicate check-in → shows already_checked_in error  
- Search returns 0 results → FTV prompt shown
- FTV form submit → person appears in list with FTV badge
- Dashboard loads → summary table visible
- Member detail page → QR code section visible

Graceful skip pattern: `if (count === 0) { test.skip(); return; }` before any locator that requires DB state.

---

## Notes

- `check_in` is partitioned by month. New month partitions must be added via migration before data for that month is written. Plan 6b does not add new partitions — existing V038 has 2026-04 and 2026-05.
- Partition gap risk: if running in June 2026+, inserts will fail. A follow-up migration (V050 or similar) should add 2026-06 through 2026-12 partitions.
- `attendance_summary` is a regular view — fast enough for dashboard at current scale.
