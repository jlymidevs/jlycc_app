# Plan 7: Programs (Heartlink) + BAC — Design Spec

**Date:** 2026-06-08
**Scope:** Admin UI for Heartlink discipleship cohorts and BAC (Bless A Community) outreach initiatives, including session management, enrollment/participation, and attendance tracking (checklist + QR scan).

---

## Overview

Adds two new admin modules to the JLYCC App:

1. **Heartlink** — discipleship cohort lifecycle: create cohorts, schedule sessions, enroll people, mark attendance per session
2. **BAC** — outreach initiative lifecycle: create initiatives, schedule sessions, add participants (walk-ins supported), mark attendance per session

No new DB migrations needed — all 10 tables already exist (V043–V049).

---

## Routes & Page Structure

```
(admin)/
├── programs/
│   ├── heartlink/
│   │   ├── page.tsx                          # Cohort list (status filter)
│   │   ├── new/page.tsx                      # Create cohort
│   │   ├── [id]/
│   │   │   ├── page.tsx                      # Cohort detail: sessions + enrollee count
│   │   │   ├── edit/page.tsx                 # Edit cohort
│   │   │   ├── enroll/page.tsx               # Add person to cohort
│   │   │   └── sessions/
│   │   │       ├── new/page.tsx              # Add session to cohort
│   │   │       └── [sid]/
│   │   │           └── attendance/page.tsx   # Checklist + QR scan
│   └── bac/
│       ├── page.tsx                          # Initiative list (status filter)
│       ├── new/page.tsx                      # Create initiative
│       ├── [id]/
│       │   ├── page.tsx                      # Initiative detail: sessions + participant count
│       │   ├── edit/page.tsx                 # Edit initiative
│       │   ├── participants/page.tsx         # Add participant
│       │   └── sessions/
│       │       ├── new/page.tsx              # Add session to initiative
│       │       └── [sid]/
│       │           └── attendance/page.tsx   # Checklist + QR scan (walk-in supported)
```

**Admin nav:** Add **Programs** link to `app/src/app/(admin)/layout.tsx` alongside Members / Events / Attendance.

**Middleware:** `/programs/*` routes are already covered by the existing auth middleware pattern (protected by default under `(admin)`).

---

## Data Layer

### Drizzle Schema Files (new)

**`app/src/schema/programs.ts`**
- `heartlinkCohort` — maps `programs.heartlink_cohort`
- `heartlinkEnrollment` — maps `programs.heartlink_enrollment`
- `heartlinkSession` — maps `programs.heartlink_session`
- `heartlinkSessionAttendance` — maps `programs.heartlink_session_attendance`

**`app/src/schema/missions.ts`**
- `bacInitiative` — maps `missions.bac_initiative`
- `bacSession` — maps `missions.bac_session`
- `bacParticipant` — maps `missions.bac_participant`
- `bacSessionAttendance` — maps `missions.bac_session_attendance`

### Server Actions (new)

**`app/src/actions/programs.ts`**
- `createCohort(formData)` — insert heartlink_cohort, revalidate list
- `updateCohort(id, formData)` — update cohort fields
- `enrollPerson(cohortId, formData)` — insert heartlink_enrollment (unique per cohort+person)
- `createHeartlinkSession(cohortId, formData)` — insert heartlink_session
- `markHeartlinkAttendance(sessionId, enrollmentId, attended)` — upsert heartlink_session_attendance
- `checkInHeartlinkQr(sessionId, personId)` — resolve enrollment → upsert attendance

**`app/src/actions/bac.ts`**
- `createInitiative(formData)` — insert bac_initiative
- `updateInitiative(id, formData)` — update initiative fields
- `addParticipant(initiativeId, formData)` — insert bac_participant
- `createBacSession(initiativeId, formData)` — insert bac_session
- `markBacAttendance(sessionId, personId, attended)` — upsert bac_session_attendance
- `checkInBacQr(sessionId, personId)` — look up person → upsert attendance, auto-insert WALK_IN if not in bac_participant

### Zod Validation Files (new)

**`app/src/lib/validations/program.ts`**
- `createCohortSchema` — name (required), branch_id, starts_on, ends_on, session_count, status
- `enrollPersonSchema` — person_id (required)
- `createHeartlinkSessionSchema` — session_number (required), topic, scheduled_at, duration_minutes, venue

**`app/src/lib/validations/bac.ts`**
- `createInitiativeSchema` — name (required), branch_id, target_community, starts_on, ends_on, status
- `addParticipantSchema` — person_id (required), role (default: PARTICIPANT)
- `createBacSessionSchema` — session_number (required), topic, scheduled_at, duration_minutes, venue

---

## Attendance UI

Both attendance pages (`/sessions/[sid]/attendance`) share the same layout:

1. **Checklist section** — table of enrollees/participants with present/absent toggle per row. Server action called on each toggle. No form submit needed — immediate upsert.
2. **QR scanner section** — reuses `QrScanner.tsx` component. On scan resolves `person_id` → calls `checkInHeartlinkQr` or `checkInBacQr`. Success shows name + "Checked in". Error shows inline message below scanner.

**BAC walk-in behavior:** `checkInBacQr` checks if person exists in `bac_participant` for the initiative. If not → inserts row with `role=PARTICIPANT`, then upserts attendance with `attended_as=WALK_IN`.

---

## Error Handling

- Server actions return `{ errors: FieldErrors }` on Zod validation failure
- Server actions return `{ error: string }` on DB error (try/catch pattern from existing actions)
- Pages surface errors inline — red text below form fields, no toast library
- QR scan errors (invalid code, person not found) → inline message below scanner, scanner stays active
- Duplicate enrollment attempt → action returns `{ error: "Person already enrolled" }`

---

## Testing

### Unit Tests (Vitest)

**`app/tests/unit/program.test.ts`**
- `createCohortSchema`: valid input, missing name, invalid date range
- `createHeartlinkSessionSchema`: valid input, missing session_number

**`app/tests/unit/bac.test.ts`**
- `createInitiativeSchema`: valid input, missing name
- `addParticipantSchema`: valid role values, invalid role

### E2E Tests (Playwright)

**`app/tests/e2e/programs.spec.ts`**
- Create cohort → verify appears in list
- Add session to cohort → verify on cohort detail
- Enroll person → verify enrollee count
- Mark attendance via checklist → verify persisted
- Create initiative → verify appears in list
- Add BAC session → verify on initiative detail
- Add participant → verify participant count
- Mark BAC attendance (checklist)
- BAC QR walk-in: scan unknown person → auto-enrolled as walk-in

---

## File Count Summary

| Type | Count |
|------|-------|
| Route page files | 14 |
| Schema files | 2 |
| Action files | 2 |
| Validation files | 2 |
| Unit test files | 2 |
| E2E test file | 1 |
| Nav update (existing file) | 1 |
| **Total** | **24 changes** |

No migrations. No new components (QrScanner reused).

---

## Safety Notes

- Do NOT modify `db/migrations/` — schema already complete
- `programs.heartlink_enrollment` has UNIQUE(cohort_id, person_id) — handle conflict in action
- `bac_session_attendance` has UNIQUE(session_id, person_id) — use upsert (ON CONFLICT DO UPDATE)
- `heartlink_session_attendance` links via `enrollment_id`, not `person_id` — resolve enrollment first in QR action
- BAC participant is append-only — never delete rows, use `left_at` to close participation
