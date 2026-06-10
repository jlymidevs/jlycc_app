# Plan 13 — Communications

## Overview

Admin-only announcements module. Staff compose messages, target a group (all members, branch, lifecycle stage, or manual), publish, and the system fans out recipients into `announcement_recipient`. No email/SMS delivery in this plan — DB fan-out only. Delivery infrastructure is Plan 14.

## Scope

| # | Deliverable |
|---|-------------|
| 1 | Flyway migration `V066__communications_schema.sql` |
| 2 | Drizzle schema `app/src/schema/communications.ts` |
| 3 | Zod validation + unit tests |
| 4 | Server actions (`createAnnouncement`, `publishAnnouncement`, `archiveAnnouncement`, `listAnnouncements`, `getAnnouncement`) |
| 5 | Admin pages: `/announcements` list, `/announcements/new`, `/announcements/[id]` detail |
| 6 | E2E tests |

## DB Schema

### `communications.announcement`

| Column | Type | Notes |
|--------|------|-------|
| `announcement_id` | bigserial PK | |
| `title` | text NOT NULL | |
| `body` | text NOT NULL | Plain text for now |
| `target_type` | enum NOT NULL | `ALL_MEMBERS`, `BRANCH`, `LIFECYCLE_STAGE`, `MANUAL` |
| `target_id` | text | branchId (cast) or stageCode; NULL for ALL_MEMBERS / MANUAL |
| `status` | enum NOT NULL | `DRAFT`, `PUBLISHED`, `ARCHIVED`; default `DRAFT` |
| `published_at` | timestamptz | Set when status → PUBLISHED |
| `created_by_person_id` | bigint FK → core.person | Nullable (system) |
| `created_at` | timestamptz NOT NULL default now() | |
| `updated_at` | timestamptz NOT NULL default now() | |

### `communications.announcement_recipient`

| Column | Type | Notes |
|--------|------|-------|
| `recipient_id` | bigserial PK | |
| `announcement_id` | bigint FK → announcement ON DELETE CASCADE | |
| `person_id` | bigint FK → core.person | |
| `delivered_at` | timestamptz | NULL until delivery infra (Plan 14) |
| `read_at` | timestamptz | NULL until read tracking |
| `created_at` | timestamptz NOT NULL default now() | |

Unique constraint: `(announcement_id, person_id)` — no duplicate recipients.

## Flyway Migration — `V066__communications_schema.sql`

```sql
CREATE SCHEMA IF NOT EXISTS communications;

CREATE TYPE communications.announcement_target_type AS ENUM (
  'ALL_MEMBERS', 'BRANCH', 'LIFECYCLE_STAGE', 'MANUAL'
);

CREATE TYPE communications.announcement_status AS ENUM (
  'DRAFT', 'PUBLISHED', 'ARCHIVED'
);

CREATE TABLE communications.announcement (
  announcement_id  BIGSERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  target_type      communications.announcement_target_type NOT NULL,
  target_id        TEXT,
  status           communications.announcement_status NOT NULL DEFAULT 'DRAFT',
  published_at     TIMESTAMPTZ,
  created_by_person_id BIGINT REFERENCES core.person(person_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE communications.announcement_recipient (
  recipient_id     BIGSERIAL PRIMARY KEY,
  announcement_id  BIGINT NOT NULL REFERENCES communications.announcement(announcement_id) ON DELETE CASCADE,
  person_id        BIGINT NOT NULL REFERENCES core.person(person_id),
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, person_id)
);
```

## Fan-Out Logic (publishAnnouncement)

When status → PUBLISHED:
- `ALL_MEMBERS`: insert recipients for all `person_id` from `membership.member` where `deleted_at IS NULL`
- `BRANCH`: insert recipients for members where `branch_id = target_id::bigint`
- `LIFECYCLE_STAGE`: insert recipients for members where `current_stage = target_id`
- `MANUAL`: recipients already inserted individually before publish (future — skip for now, treat same as ALL_MEMBERS)

Use `INSERT ... ON CONFLICT DO NOTHING` to be safe on re-publish attempts.

## Files to Create / Modify

| File | Action |
|------|--------|
| `db/migrations/V066__communications_schema.sql` | Create — migration |
| `app/src/schema/communications.ts` | Create — Drizzle schema |
| `app/src/lib/validations/announcements.ts` | Create — Zod schemas |
| `app/src/actions/announcements.ts` | Create — 5 server actions |
| `app/src/app/(admin)/announcements/page.tsx` | Create — list page |
| `app/src/app/(admin)/announcements/new/page.tsx` | Create — compose form |
| `app/src/app/(admin)/announcements/[id]/page.tsx` | Create — detail page |
| `app/src/app/(admin)/layout.tsx` or nav | Modify — add Announcements nav link |
| `app/tests/unit/announcements.test.ts` | Create — Zod unit tests |
| `app/tests/e2e/announcements.spec.ts` | Create — E2E tests |

## Zod Schemas

`lib/validations/announcements.ts`:
- `createAnnouncementSchema` — title (1–200 chars), body (1–5000 chars), target_type, target_id (optional string)
- `publishAnnouncementSchema` — id (positive int)

## Unit Tests (target: ~15 tests)

- `createAnnouncementSchema` accepts valid input
- `createAnnouncementSchema` rejects empty title
- `createAnnouncementSchema` rejects title > 200 chars
- `createAnnouncementSchema` rejects empty body
- `createAnnouncementSchema` rejects body > 5000 chars
- `createAnnouncementSchema` requires target_type to be valid enum value
- `createAnnouncementSchema` rejects invalid target_type
- `createAnnouncementSchema` allows target_id to be absent for ALL_MEMBERS
- `createAnnouncementSchema` allows target_id for BRANCH
- `publishAnnouncementSchema` accepts positive int
- `publishAnnouncementSchema` rejects zero
- `publishAnnouncementSchema` rejects negative
- `publishAnnouncementSchema` rejects non-integer

## E2E Tests (target: 5 tests)

`announcements.spec.ts`:
1. Staff can create a draft announcement and land on detail page
2. Draft announcement shows DRAFT status badge
3. Staff can publish an announcement (status → PUBLISHED)
4. Published announcement shows recipient count > 0
5. Staff can archive an announcement

## Admin Pages

### `/announcements` — List
Table: title, target type, status badge, recipient count, published date. "New announcement" button → `/announcements/new`.

### `/announcements/new` — Compose
Form: title input, body textarea, target_type select (ALL_MEMBERS / BRANCH / LIFECYCLE_STAGE), conditional target_id select (branch list or stage list depending on target_type). Submit → creates DRAFT → redirect to `/announcements/[id]`.

### `/announcements/[id]` — Detail
Shows title, body, target, status. Buttons:
- **Publish** (if DRAFT) → calls `publishAnnouncement`
- **Archive** (if PUBLISHED) → calls `archiveAnnouncement`
Recipient section: count + first 20 names.

## Tasks

### Task 1 — DB Migration + Drizzle Schema
Files: `db/migrations/V066__communications_schema.sql`, `app/src/schema/communications.ts`
Run `docker compose up -d` to apply migration. Verify with `npx tsc --noEmit`.

### Task 2 — Zod Validation + Unit Tests
Files: `lib/validations/announcements.ts`, `tests/unit/announcements.test.ts`
Target: ~15 unit tests passing.

### Task 3 — Server Actions
Files: `actions/announcements.ts`
Actions: `createAnnouncement`, `publishAnnouncement`, `archiveAnnouncement`, `listAnnouncements`, `getAnnouncement`.
Fan-out logic in `publishAnnouncement`.

### Task 4 — List + New pages
Files: `app/(admin)/announcements/page.tsx`, `app/(admin)/announcements/new/page.tsx`
Add "Announcements" nav link to admin layout.

### Task 5 — Detail page
Files: `app/(admin)/announcements/[id]/page.tsx`
Publish + archive buttons via form actions. Recipient count + preview list.

### Task 6 — E2E Tests
Files: `tests/e2e/announcements.spec.ts`
5 tests. All staff-auth required.

## No New Auth Needed

Announcements pages live in `/(admin)/` — protected by existing NextAuth middleware.

## Env Vars

None new required.
