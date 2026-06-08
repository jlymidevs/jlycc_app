# JLY Church App — Plan 6a: Events Management Design

## Goal

Add staff-facing event management and a public event listing + registration portal. Build on existing `events` schema (V033–V037) — no new migrations needed.

## Scope

**In scope (Plan 6a):**
- Staff: create, edit, cancel events (standalone + series)
- Staff: view registrant list per event; confirm or cancel individual registrations
- Public: list upcoming events; register with name + email only
- Duplicate registration guard (find/create `core.person` by email)

**Out of scope:**
- Attendance tracking (Plan 6b)
- Public user accounts / login
- Payment processing
- Notifications / reminders

---

## Architecture

### New Files

```
app/src/
├── schema/
│   └── events.ts                  # Drizzle definitions for events schema
├── actions/
│   └── events.ts                  # staff mutations (create, update, cancel)
│   └── registrations.ts           # public register + staff confirm/cancel
├── lib/validations/
│   └── event.ts                   # Zod schemas
└── app/
    ├── (admin)/
    │   └── events/
    │       ├── page.tsx            # event list
    │       ├── new/page.tsx        # create form
    │       └── [id]/
    │           ├── page.tsx        # event detail + registrant list
    │           └── edit/page.tsx   # edit form
    └── (public)/
        └── events/
            ├── page.tsx            # public listing
            └── [id]/
                └── page.tsx        # event detail + registration form
```

### Route Groups

| Group | Middleware | URL pattern |
|---|---|---|
| `(admin)` | Auth required (existing) | `/events/*` |
| `(public)` | No auth | `/events/*` |

Public and admin routes live under different route groups. Same URL prefix `/events` is fine — Next.js resolves by route group layout, not URL collision.

### Existing DB Schema (no migrations needed)

Key tables used:

| Table | Purpose |
|---|---|
| `events.event` | Event record (title, description, dates, capacity, status, location, series_id) |
| `events.event_series` | Series grouping (name, description) |
| `events.event_organizer` | Staff assigned as organizer per event |
| `events.event_registration` | Registration record linking `event_id` + `person_id` |
| `events.registration_status` | Enum: REGISTERED, CONFIRMED, WAITLISTED, CANCELLED, NO_SHOW |

`event_registration` uses `person_id` (not `member_id`) → non-members can register.

---

## Staff Event Management

### Routes

| Route | Purpose |
|---|---|
| `GET /events` | Paginated list; filter by status (upcoming/past/cancelled) |
| `GET /events/new` | Create form |
| `POST /events/new` | Server Action — insert `events.event` |
| `GET /events/[id]` | Event detail + inline registrant list |
| `GET /events/[id]/edit` | Edit form |
| `POST /events/[id]/edit` | Server Action — update event |
| `POST /events/[id]/cancel` | Server Action — set status = CANCELLED |

### Event Form Fields

| Field | Required | Notes |
|---|---|---|
| title | yes | |
| description | no | textarea |
| event_type | yes | enum from DB |
| start_date | yes | datetime-local |
| end_date | no | must be ≥ start_date if set |
| location_name | no | |
| capacity | no | positive int |
| series_id | no | select existing series or blank |
| status | auto | defaults to SCHEDULED on create |

### Registrant List (inline on event detail)

Shown on `GET /events/[id]` — server component:
- Table: name, email, registered_at, status
- Per-row: Confirm button (→ CONFIRMED), Cancel button (→ CANCELLED)
- Button triggers Server Action `updateRegistrationStatus(registrationId, newStatus)`
- `revalidatePath` on same page after mutation

---

## Public Portal

### Routes

| Route | Purpose |
|---|---|
| `GET /events` (public layout) | Upcoming events list (status = SCHEDULED or CONFIRMED) |
| `GET /events/[id]` (public layout) | Event detail + registration form |
| `POST /events/[id]/register` | Server Action — register person |

### Public Event List

- Shows: title, date, location, spots remaining (`capacity - confirmed_count`)
- No login required
- Past/cancelled events hidden

### Registration Flow

Form fields: name (required), email (required).

Server Action `registerForEvent(eventId, formData)`:

1. Validate with Zod (name min 1, email valid format)
2. Look up `core.person` by email in `core.contact_info`
3. If found → use existing `person_id`
4. If not found → insert `core.person` + `core.contact_info`
5. Check for duplicate: query `events.event_registration` WHERE `event_id = ? AND person_id = ? AND status != 'CANCELLED'`
6. If duplicate → return `{ error: "already_registered" }` → show friendly message
7. Check capacity: count confirmed+registered < capacity (if capacity set)
8. If full → insert with status `WAITLISTED`; else insert with status `REGISTERED`
9. Return `{ success: true }` → show confirmation message on same page

No redirect on success — show inline confirmation with event details.

---

## Data Flow & Validation

### Zod Schemas (`lib/validations/event.ts`)

```typescript
export const createEventSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  eventType: z.string().min(1),
  startDate: z.string().datetime({ local: true }),
  endDate: z.string().datetime({ local: true }).optional(),
  locationName: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  seriesId: z.number().int().positive().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const publicRegisterSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
});
```

### Drizzle Schema (`schema/events.ts`)

Define tables: `eventsSchema.event`, `eventsSchema.eventRegistration`, `eventsSchema.eventSeries`, `eventsSchema.eventOrganizer`. Mirror V033–V037 columns exactly. Use `pgEnum` for `registration_status`.

### Read Pattern (Server Components)

```
RSC → Drizzle query (app_reader) → typed result → render
```

Registrant count subquery on event list (avoid N+1):
```sql
SELECT e.*, COUNT(r.registration_id) FILTER (WHERE r.status IN ('REGISTERED','CONFIRMED')) as registration_count
FROM events.event e
LEFT JOIN events.event_registration r ON r.event_id = e.event_id
GROUP BY e.event_id
```

### Mutation Pattern (Server Actions)

```
form → Server Action → Zod validate → Drizzle write (app_writer) → revalidatePath → redirect or return result
```

---

## Testing

### Unit (Vitest)

- `createEventSchema`: valid input passes, missing title fails, invalid date fails
- `publicRegisterSchema`: valid name+email passes, missing name fails, bad email fails
- `updateEventSchema`: all fields optional

### E2E (Playwright)

Happy path scenarios:

1. **Staff create event** — login → `/events/new` → fill form → submit → land on event detail
2. **Staff edit event** — event detail → edit → change title → submit → see updated title
3. **Staff cancel event** — event detail → Cancel Event → status shows CANCELLED
4. **Public register** — `/events/[id]` (public) → fill name+email → submit → see confirmation
5. **Duplicate registration** — register same email twice → see "already registered" message
6. **Staff see registrant** — after public register → staff event detail → registrant in list
7. **Staff confirm registrant** — click Confirm → status changes to CONFIRMED

---

## Plan 6a Deliverables

1. `app/src/schema/events.ts` — Drizzle table definitions
2. `app/src/lib/validations/event.ts` — Zod schemas
3. `app/src/actions/events.ts` — create, update, cancel
4. `app/src/actions/registrations.ts` — public register, staff confirm/cancel
5. Staff routes: `/events`, `/events/new`, `/events/[id]`, `/events/[id]/edit`
6. Public routes: `(public)/events`, `(public)/events/[id]`
7. Vitest unit tests for Zod schemas
8. Playwright E2E: 7 scenarios above
