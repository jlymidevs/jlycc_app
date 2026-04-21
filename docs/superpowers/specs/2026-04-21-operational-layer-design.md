# JLY Church Database — Plan 2: Operational Layer Design

## Goal

Add the `ministries`, `events`, and `attendance` schemas to the foundation established in Plan 1. This layer covers ministry hierarchy, event management, check-in/attendance tracking (with monthly partitioning), visitor intake, child safety check-in, and event registration.

## Architecture

Single plan, three phases executed in dependency order:

1. **Phase 1: `ministries`** — Network → Ministry → Branch Chapter → Membership. Seeds for networks and ministries.
2. **Phase 2: `events`** — Event categories, types, series, instances, organizers, registration. Seeds for event types.
3. **Phase 3: `attendance`** — Partitioned check_in, visitor capture (FTV intake), child check-in extension, attendance summary view, and `attendance_writer` DB role.

Dependencies: `attendance` → `events` → `ministries` → `core` + `membership` (Plan 1).

## Tech Stack

Same as Plan 1: PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows.

---

## Phase 1: `ministries` Schema

### New Schema

`CREATE SCHEMA IF NOT EXISTS ministries;`

### Enums

- `ministries.chapter_status` — ACTIVE, PAUSED, CLOSED
- `ministries.leader_role` — HEAD, ASSISTANT_HEAD, COORDINATOR

### Tables

#### `ministries.network`

Top-level groupings. Seeded with 3 rows.

| Column | Type | Constraints |
|---|---|---|
| `network_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `founded_on` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Trigger: `trg_network_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Top-level ministry grouping (Eagles, Wind, Lead Takers).'

#### `ministries.ministry`

The actual ministry unit. ~16 seeded rows.

| Column | Type | Constraints |
|---|---|---|
| `ministry_id` | BIGSERIAL | PRIMARY KEY |
| `network_id` | BIGINT | NOT NULL, FK → network |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `target_demographic` | TEXT | |
| `founded_on` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_ministry_network` ON (network_id)
- Trigger: `trg_ministry_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'A ministry (Move, CCEM, LT Pro, etc.) under a network.'

#### `ministries.ministry_chapter`

Per-branch instance of a ministry.

| Column | Type | Constraints |
|---|---|---|
| `chapter_id` | BIGSERIAL | PRIMARY KEY |
| `ministry_id` | BIGINT | NOT NULL, FK → ministry |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch |
| `launched_on` | DATE | |
| `status` | ministries.chapter_status | NOT NULL DEFAULT 'ACTIVE' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(ministry_id, branch_id)`
- Index: `idx_chapter_branch` ON (branch_id)
- Index: `idx_chapter_status` ON (status)
- Trigger: `trg_chapter_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Per-branch instance of a ministry. UNIQUE(ministry_id, branch_id).'

#### `ministries.ministry_membership`

Member ↔ chapter link with optional leadership info.

| Column | Type | Constraints |
|---|---|---|
| `membership_id` | BIGSERIAL | PRIMARY KEY |
| `chapter_id` | BIGINT | NOT NULL, FK → ministry_chapter ON DELETE CASCADE |
| `member_id` | BIGINT | NOT NULL, FK → membership.member ON DELETE CASCADE |
| `joined_at` | TIMESTAMPTZ | NOT NULL |
| `ended_at` | TIMESTAMPTZ | |
| `ended_reason` | TEXT | |
| `is_leader` | BOOLEAN | NOT NULL DEFAULT false |
| `leader_role` | ministries.leader_role | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- CHECK: `(is_leader = false AND leader_role IS NULL) OR (is_leader = true AND leader_role IS NOT NULL)` named `ministry_membership_leader_check`
- Index: `idx_ministry_membership_chapter` ON (chapter_id)
- Index: `idx_ministry_membership_member` ON (member_id)
- Index: `idx_ministry_membership_active` ON (chapter_id) WHERE ended_at IS NULL
- Comment: 'Member ↔ chapter with optional leadership role. Append-only; close by setting ended_at.'

### Seeds

#### `R__seed_networks.sql`

```
Eagles, Wind, Lead Takers
```

ON CONFLICT (code) DO UPDATE SET name, description.

#### `R__seed_ministries.sql`

| Network | Code | Ministry Name |
|---|---|---|
| Eagles | MOVE | Move |
| Eagles | CCEM | CCEM |
| Eagles | HARPS_AND_BOWLS | Harps and Bowls |
| Eagles | KINGDOM_KIDS | Kingdom Kids |
| Wind | COUPLES | Couples Ministry |
| Wind | MISSIONS | Missions |
| Lead Takers | LT_CONNECT | LT Connect |
| Lead Takers | LT_YOUTH | LT Youth |
| Lead Takers | LT_PRO | LT Pro |

These are the initial seeds. User will adjust post-implementation as needed.

ON CONFLICT (code) DO UPDATE SET name, description, network_id, target_demographic.

---

## Phase 2: `events` Schema

### New Schema

`CREATE SCHEMA IF NOT EXISTS events;`

### Enums

- `events.recurrence_pattern` — DAILY, WEEKLY, MONTHLY, YEARLY
- `events.series_status` — ACTIVE, PAUSED, ENDED
- `events.event_status` — SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- `events.registration_status` — REGISTERED, CONFIRMED, WAITLISTED, CANCELLED, NO_SHOW

### Tables

#### `events.event_category`

Natural-key lookup. 2 rows.

| Column | Type | Constraints |
|---|---|---|
| `category_code` | TEXT | PRIMARY KEY |
| `name` | TEXT | NOT NULL |

- Comment: 'Event categories: SEASONAL (one-off) or REGULAR (recurring).'

#### `events.event_type`

Lookup of event types. ~15 seeded rows.

| Column | Type | Constraints |
|---|---|---|
| `event_type_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `category_code` | TEXT | NOT NULL, FK → event_category |
| `network_id` | BIGINT | nullable, FK → ministries.network |
| `ministry_id` | BIGINT | nullable, FK → ministries.ministry |
| `typical_duration_minutes` | INT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_event_type_category` ON (category_code)
- Trigger: `trg_event_type_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Lookup of event types. network_id/ministry_id link to owning ministry when applicable.'

#### `events.event_series`

Recurring schedule template.

| Column | Type | Constraints |
|---|---|---|
| `series_id` | BIGSERIAL | PRIMARY KEY |
| `event_type_id` | BIGINT | NOT NULL, FK → event_type |
| `branch_id` | BIGINT | nullable, FK → core.branch (NULL = org-wide) |
| `name` | TEXT | NOT NULL |
| `recurrence_pattern` | events.recurrence_pattern | NOT NULL |
| `recurrence_config` | JSONB | NOT NULL DEFAULT '{}' |
| `starts_on` | DATE | NOT NULL |
| `ends_on` | DATE | |
| `status` | events.series_status | NOT NULL DEFAULT 'ACTIVE' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_series_event_type` ON (event_type_id)
- Index: `idx_series_branch` ON (branch_id)
- Trigger: `trg_series_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Recurring event schedule. recurrence_config JSONB is app-interpreted (e.g., {"day_of_week": "SUN", "time": "09:00"}).'

#### `events.event`

Concrete event instance.

| Column | Type | Constraints |
|---|---|---|
| `event_id` | BIGSERIAL | PRIMARY KEY |
| `event_type_id` | BIGINT | NOT NULL, FK → event_type |
| `series_id` | BIGINT | nullable, FK → event_series |
| `branch_id` | BIGINT | nullable, FK → core.branch (NULL = org-wide) |
| `host_branch_id` | BIGINT | nullable, FK → core.branch (physical host) |
| `name` | TEXT | NOT NULL |
| `starts_at` | TIMESTAMPTZ | NOT NULL |
| `ends_at` | TIMESTAMPTZ | |
| `venue` | TEXT | |
| `expected_attendance` | INT | |
| `status` | events.event_status | NOT NULL DEFAULT 'SCHEDULED' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_event_type` ON (event_type_id)
- Index: `idx_event_series` ON (series_id)
- Index: `idx_event_branch` ON (branch_id)
- Index: `idx_event_starts_at` ON (starts_at DESC)
- Index: `idx_event_status` ON (status)
- Trigger: `trg_event_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Concrete event instance. branch_id = owning branch; host_branch_id = physical venue branch (may differ for org-wide events).'

#### `events.event_organizer`

Who runs the event. Composite PK.

| Column | Type | Constraints |
|---|---|---|
| `event_id` | BIGINT | NOT NULL, FK → event ON DELETE CASCADE |
| `member_id` | BIGINT | NOT NULL, FK → membership.member |
| `role` | TEXT | NOT NULL |
| `added_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- PRIMARY KEY: (event_id, member_id)
- Index: `idx_organizer_member` ON (member_id)
- Comment: 'Event ↔ organizer assignment. Composite PK (event_id, member_id).'

#### `events.event_registration`

RSVP for big events. PII table.

| Column | Type | Constraints |
|---|---|---|
| `registration_id` | BIGSERIAL | PRIMARY KEY |
| `event_id` | BIGINT | NOT NULL, FK → event |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `registered_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `registered_by_member_id` | BIGINT | nullable, FK → membership.member |
| `status` | events.registration_status | NOT NULL DEFAULT 'REGISTERED' |
| `accommodation_required` | BOOLEAN | NOT NULL DEFAULT false |
| `dietary_requirements` | TEXT | |
| `group_size` | INT | NOT NULL DEFAULT 1 |
| `emergency_contact_name` | TEXT | |
| `emergency_contact_phone` | TEXT | |
| `payment_reference` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_registration_event` ON (event_id)
- Index: `idx_registration_person` ON (person_id)
- Index: `idx_registration_status` ON (event_id, status)
- Trigger: `trg_registration_updated_at` BEFORE UPDATE → `set_updated_at()`
- PII: REVOKE SELECT from `app_general` (emergency contact, dietary info)
- PII COMMENT markers on `emergency_contact_name`, `emergency_contact_phone`, `dietary_requirements`
- Comment: 'Event registration/RSVP. Uses person_id (not member_id) so non-members can register. PII: emergency contact, dietary info.'

### Seeds

#### `R__seed_event_types.sql`

Seeds both `event_category` (2 rows) and `event_type` (~15 rows) in one file. ON CONFLICT upsert.

Categories: SEASONAL, REGULAR.

Event types (from spec):

| Code | Name | Category | Network/Ministry link |
|---|---|---|---|
| SUNDAY_SERVICE | Sunday Service | REGULAR | NULL (org-wide) |
| FRIDAY_PRAYER | Friday Prayer Meeting | REGULAR | NULL |
| GNY | Grand New Year | SEASONAL | NULL |
| CAMP_MEETING | Camp Meeting | SEASONAL | NULL |
| APC | Annual Pastors Conference | SEASONAL | NULL |
| MID_YEAR_PC | Mid-Year Pastors Conference | SEASONAL | NULL |
| ANNIVERSARY | Church Anniversary | SEASONAL | NULL |
| CHRISTMAS | Christmas Celebration | SEASONAL | NULL |
| COUPLES | Couples Event | SEASONAL | Wind / Couples Ministry |
| MISSIONS_MONTH | Missions Month | SEASONAL | Wind / Missions |
| LT_CONNECT | LT Connect | REGULAR | Lead Takers / LT Connect |
| KINGDOM_KIDS | Kingdom Kids | REGULAR | Eagles / Kingdom Kids |
| LT_YOUTH | LT Youth | REGULAR | Lead Takers / LT Youth |
| LT_PRO | LT Pro | REGULAR | Lead Takers / LT Pro |
| HARPS_AND_BOWLS | Harps and Bowls | REGULAR | Eagles / Harps and Bowls |

Network/ministry FK resolution done via subqueries in the seed file.

---

## Phase 3: `attendance` Schema

### New Schema

`CREATE SCHEMA IF NOT EXISTS attendance;`

### Enums

- `attendance.check_in_method` — SELF, USHER, BULK_IMPORT

### Tables

#### `attendance.check_in` (PARTITIONED)

High-volume check-in table. Partitioned by RANGE on `checked_in_at`, monthly.

| Column | Type | Constraints |
|---|---|---|
| `check_in_id` | BIGSERIAL | |
| `event_id` | BIGINT | NOT NULL, FK → events.event |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch (denormalized) |
| `checked_in_at` | TIMESTAMPTZ | NOT NULL |
| `check_in_method` | attendance.check_in_method | NOT NULL DEFAULT 'USHER' |
| `captured_by_member_id` | BIGINT | nullable, FK → membership.member |
| `ftv_capture_id` | BIGINT | nullable (FK added after visitor_capture exists) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- PRIMARY KEY: `(check_in_id, checked_in_at)` — `checked_in_at` must be in the PK for partition routing
- Index: `idx_check_in_event` ON (event_id)
- Index: `idx_check_in_person` ON (person_id, checked_in_at DESC)
- Index: `idx_check_in_branch` ON (branch_id, checked_in_at DESC)
- Initial partitions: `check_in_2026_04` (April 2026), `check_in_2026_05` (May 2026)
- Comment: 'Per-person check-in. Partitioned by month on checked_in_at. Uses person_id (not member_id) so FTVs work.'

**Partitioning notes:**
- `PARTITION BY RANGE (checked_in_at)` on the parent table
- Each partition: `CREATE TABLE attendance.check_in_YYYY_MM PARTITION OF attendance.check_in FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01')`
- Future partition creation and archival are operational concerns, not handled in this migration

#### `attendance.visitor_capture`

FTV intake form. PII table.

| Column | Type | Constraints |
|---|---|---|
| `ftv_capture_id` | BIGSERIAL | PRIMARY KEY |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `event_id` | BIGINT | NOT NULL, FK → events.event |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch |
| `captured_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `captured_by_member_id` | BIGINT | nullable, FK → membership.member |
| `invited_by_person_id` | BIGINT | nullable, FK → core.person |
| `consent_to_contact` | BOOLEAN | NOT NULL DEFAULT false |
| `intake_notes` | TEXT | |
| `converted_member_id` | BIGINT | nullable, FK → membership.member (set when FTV becomes member) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_visitor_capture_person` ON (person_id)
- Index: `idx_visitor_capture_event` ON (event_id)
- Index: `idx_visitor_capture_branch` ON (branch_id)
- PII: REVOKE SELECT from `app_general`
- PII COMMENT on `intake_notes`
- Comment: 'FTV intake form. Links a new person to the event where they were first captured. PII: intake_notes.'

**After visitor_capture is created:** Add FK constraint on `check_in.ftv_capture_id` → `visitor_capture(ftv_capture_id)`.

#### `attendance.child_check_in`

Child safety extension. 1:1 with check_in.

| Column | Type | Constraints |
|---|---|---|
| `check_in_id` | BIGINT | PRIMARY KEY, FK → check_in (see note below) |
| `checked_in_at` | TIMESTAMPTZ | NOT NULL (denormalized for FK to partitioned parent) |
| `event_id` | BIGINT | NOT NULL (denormalized for pickup_code uniqueness) |
| `parent_check_in_id` | BIGINT | nullable (FK to check_in — see note) |
| `parent_checked_in_at` | TIMESTAMPTZ | nullable (needed for FK to partitioned parent) |
| `pickup_code` | TEXT | NOT NULL |
| `allergies` | TEXT | |
| `picked_up_at` | TIMESTAMPTZ | |
| `picked_up_by_person_id` | BIGINT | nullable, FK → core.person |
| `pickup_verified_by_member_id` | BIGINT | nullable, FK → membership.member |

- FK to partitioned check_in requires the partition key: `FOREIGN KEY (check_in_id, checked_in_at) REFERENCES check_in(check_in_id, checked_in_at)`
- FK for parent: `FOREIGN KEY (parent_check_in_id, parent_checked_in_at) REFERENCES check_in(check_in_id, checked_in_at)` (nullable)
- Unique constraint: `UNIQUE(event_id, pickup_code)` — ensures pickup codes are unique per event
- Index: `idx_child_check_in_parent` ON (parent_check_in_id)
- PII: REVOKE SELECT from `app_general` (allergies)
- PII COMMENT on `allergies`
- Comment: 'Child check-in extension. 1:1 with check_in. Pickup code unique per event for child safety.'

### View

#### `attendance.attendance_summary`

Regular view (not materialized). Converts to materialized when dashboard performance demands it.

```sql
CREATE VIEW attendance.attendance_summary AS
SELECT
  c.event_id,
  c.branch_id,
  date_trunc('week', c.checked_in_at)::date AS week_start,
  count(*) AS total_check_ins,
  count(DISTINCT c.person_id) AS unique_persons,
  count(c.ftv_capture_id) AS ftv_count
FROM attendance.check_in c
GROUP BY c.event_id, c.branch_id, date_trunc('week', c.checked_in_at)::date;
```

### DB Role

#### `attendance_writer`

Used by check-in kiosks/apps. INSERT/UPDATE only on attendance tables.

```sql
CREATE ROLE attendance_writer NOLOGIN;
GRANT USAGE ON SCHEMA attendance TO attendance_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA attendance TO attendance_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA attendance TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT INSERT, UPDATE ON TABLES TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT USAGE, SELECT ON SEQUENCES TO attendance_writer;
```

Also needs SELECT on `events.event` (to validate event_id) and `core.person`/`core.branch`:

```sql
GRANT USAGE ON SCHEMA events, core TO attendance_writer;
GRANT SELECT ON events.event TO attendance_writer;
GRANT SELECT ON core.person, core.branch TO attendance_writer;
```

### PII Grants

Extend existing role grants for the new schemas:

```sql
-- app_full: full access to new schemas
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ministries, events, attendance TO app_full;

-- app_pastoral: read access to all new schemas including PII
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_pastoral;

-- app_general: read access excluding PII tables
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_general;
REVOKE SELECT ON events.event_registration FROM app_general;
REVOKE SELECT ON attendance.visitor_capture FROM app_general;
REVOKE SELECT ON attendance.child_check_in FROM app_general;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;
```

---

## Cross-Cutting Concerns

### Conventions (carried from Plan 1)

- snake_case identifiers
- BIGSERIAL PKs (or composite/natural where appropriate)
- `set_updated_at()` BEFORE UPDATE trigger on mutable tables
- pgTAP tests in `BEGIN/plan/finish/ROLLBACK` blocks
- Inline `throws_ok($$...$$)` for enum violation tests (SQLSTATE 22P02)
- `RETURNING col AS alias \gset` for psql variable binding (not `\gset prefix`)
- Repeatable migrations use ON CONFLICT DO UPDATE for idempotency

### Migration numbering

Continues from Plan 1's V027. Estimated range: V028–V045+.

### What's NOT in scope

- Materialized view refresh scheduling (operational concern)
- Partition creation cron job (operational concern)
- Partition archival/detach (operational concern)
- Application-level recurrence rule interpretation
- UI/API layer
- Historical attendance migration (explicitly excluded per spec)
