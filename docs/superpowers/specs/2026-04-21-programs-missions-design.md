# JLY Church Database — Plan 3a: Programs + Missions Design

## Goal

Add the `programs` and `missions` schemas covering Heartlink discipleship cohorts, scholarship tracking, and BAC (Bless A Community) outreach initiatives.

## Architecture

Two schemas, no dependencies on each other. Both depend on `core` (person, branch) and `membership` (member). Single plan, two phases.

1. **Phase 1: `programs`** — Heartlink cohorts, enrollments, sessions, session attendance (4 tables)
2. **Phase 2: `missions`** — Scholar programs + awards, BAC initiatives + sessions + participants + attendance (6 tables)

## Tech Stack

Same as Plans 1-2: PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows.

---

## Phase 1: `programs` Schema

### New Schema

`CREATE SCHEMA IF NOT EXISTS programs;`

### Enums

- `programs.cohort_status` — PLANNING, ACTIVE, COMPLETED, CANCELLED
- `programs.enrollment_status` — ENROLLED, ACTIVE, COMPLETED, DROPPED

### Tables

#### `programs.heartlink_cohort`

Cohort instance of the Heartlink discipleship program.

| Column | Type | Constraints |
|---|---|---|
| `cohort_id` | BIGSERIAL | PRIMARY KEY |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch |
| `name` | TEXT | NOT NULL |
| `starts_on` | DATE | |
| `ends_on` | DATE | |
| `session_count` | INT | |
| `facilitator_member_id` | BIGINT | FK → membership.member |
| `status` | programs.cohort_status | NOT NULL DEFAULT 'PLANNING' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_heartlink_cohort_branch` ON (branch_id)
- Index: `idx_heartlink_cohort_status` ON (status)
- Trigger: `trg_heartlink_cohort_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Heartlink discipleship cohort instance (e.g., "Manila Heartlink Q1 2026").'

#### `programs.heartlink_enrollment`

Person ↔ cohort enrollment.

| Column | Type | Constraints |
|---|---|---|
| `enrollment_id` | BIGSERIAL | PRIMARY KEY |
| `cohort_id` | BIGINT | NOT NULL, FK → heartlink_cohort ON DELETE CASCADE |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `enrolled_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `status` | programs.enrollment_status | NOT NULL DEFAULT 'ENROLLED' |
| `completion_date` | DATE | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(cohort_id, person_id)`
- Index: `idx_heartlink_enrollment_person` ON (person_id)
- Trigger: `trg_heartlink_enrollment_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Person ↔ Heartlink cohort. Uses person_id so non-members can enroll.'

#### `programs.heartlink_session`

Session within a cohort.

| Column | Type | Constraints |
|---|---|---|
| `session_id` | BIGSERIAL | PRIMARY KEY |
| `cohort_id` | BIGINT | NOT NULL, FK → heartlink_cohort ON DELETE CASCADE |
| `session_number` | INT | NOT NULL |
| `topic` | TEXT | |
| `scheduled_at` | TIMESTAMPTZ | |
| `duration_minutes` | INT | |
| `facilitator_member_id` | BIGINT | nullable, FK → membership.member |
| `venue` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_heartlink_session_cohort` ON (cohort_id)
- Trigger: `trg_heartlink_session_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Session within a Heartlink cohort.'

#### `programs.heartlink_session_attendance`

Per-session attendance record.

| Column | Type | Constraints |
|---|---|---|
| `attendance_id` | BIGSERIAL | PRIMARY KEY |
| `session_id` | BIGINT | NOT NULL, FK → heartlink_session ON DELETE CASCADE |
| `enrollment_id` | BIGINT | NOT NULL, FK → heartlink_enrollment ON DELETE CASCADE |
| `attended` | BOOLEAN | NOT NULL |
| `arrived_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(session_id, enrollment_id)`
- Index: `idx_heartlink_attendance_enrollment` ON (enrollment_id)
- Comment: 'Per-session Heartlink attendance. Links to enrollment (must be enrolled to track attendance).'

---

## Phase 2: `missions` Schema

### New Schema

`CREATE SCHEMA IF NOT EXISTS missions;`

### Enums

- `missions.program_status` — PLANNING, ACTIVE, COMPLETED, CANCELLED
- `missions.award_status` — AWARDED, ACTIVE, COMPLETED, REVOKED
- `missions.initiative_status` — PLANNING, ACTIVE, COMPLETED, CANCELLED
- `missions.bac_role` — LEADER, FACILITATOR, PARTICIPANT, VOLUNTEER
- `missions.attendance_role` — ENROLLED, WALK_IN, FACILITATOR

### Tables

#### `missions.scholar_program`

Scholarship program definition.

| Column | Type | Constraints |
|---|---|---|
| `program_id` | BIGSERIAL | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `starts_on` | DATE | |
| `ends_on` | DATE | |
| `description` | TEXT | |
| `status` | missions.program_status | NOT NULL DEFAULT 'PLANNING' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_scholar_program_status` ON (status)
- Trigger: `trg_scholar_program_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Scholarship program definition.'

#### `missions.scholarship_award`

Award to a JLY member.

| Column | Type | Constraints |
|---|---|---|
| `award_id` | BIGSERIAL | PRIMARY KEY |
| `program_id` | BIGINT | NOT NULL, FK → scholar_program |
| `member_id` | BIGINT | NOT NULL, FK → membership.member |
| `awarded_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `term` | TEXT | |
| `amount` | NUMERIC | |
| `school_name` | TEXT | |
| `sponsor_member_id` | BIGINT | nullable, FK → membership.member |
| `status` | missions.award_status | NOT NULL DEFAULT 'AWARDED' |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_award_program` ON (program_id)
- Index: `idx_award_member` ON (member_id)
- Index: `idx_award_sponsor` ON (sponsor_member_id)
- Trigger: `trg_scholarship_award_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Scholarship award to a JLY member. school_name is free text (internal or external school). Amount is informational only — finance handled externally.'

#### `missions.bac_initiative`

BAC outreach campaign.

| Column | Type | Constraints |
|---|---|---|
| `initiative_id` | BIGSERIAL | PRIMARY KEY |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch |
| `name` | TEXT | NOT NULL |
| `target_community` | TEXT | |
| `starts_on` | DATE | |
| `ends_on` | DATE | |
| `coordinator_member_id` | BIGINT | FK → membership.member |
| `status` | missions.initiative_status | NOT NULL DEFAULT 'PLANNING' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bac_initiative_branch` ON (branch_id)
- Index: `idx_bac_initiative_status` ON (status)
- Trigger: `trg_bac_initiative_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'BAC (Bless A Community) outreach campaign.'

#### `missions.bac_session`

Session within a BAC initiative.

| Column | Type | Constraints |
|---|---|---|
| `session_id` | BIGSERIAL | PRIMARY KEY |
| `initiative_id` | BIGINT | NOT NULL, FK → bac_initiative ON DELETE CASCADE |
| `session_number` | INT | NOT NULL |
| `topic` | TEXT | |
| `scheduled_at` | TIMESTAMPTZ | |
| `duration_minutes` | INT | |
| `venue` | TEXT | |
| `facilitator_member_id` | BIGINT | FK → membership.member |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bac_session_initiative` ON (initiative_id)
- Trigger: `trg_bac_session_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Session within a BAC initiative.'

#### `missions.bac_participant`

Person participating in a BAC initiative.

| Column | Type | Constraints |
|---|---|---|
| `participant_id` | BIGSERIAL | PRIMARY KEY |
| `initiative_id` | BIGINT | NOT NULL, FK → bac_initiative ON DELETE CASCADE |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `joined_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `left_at` | TIMESTAMPTZ | |
| `role` | missions.bac_role | NOT NULL DEFAULT 'PARTICIPANT' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bac_participant_initiative` ON (initiative_id)
- Index: `idx_bac_participant_person` ON (person_id)
- Comment: 'BAC participant. Uses person_id — open to non-members. Append-only; close by setting left_at.'

#### `missions.bac_session_attendance`

Per-session BAC attendance (supports walk-ins).

| Column | Type | Constraints |
|---|---|---|
| `attendance_id` | BIGSERIAL | PRIMARY KEY |
| `session_id` | BIGINT | NOT NULL, FK → bac_session ON DELETE CASCADE |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `attended` | BOOLEAN | NOT NULL |
| `attended_as` | missions.attendance_role | NOT NULL DEFAULT 'ENROLLED' |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(session_id, person_id)`
- Index: `idx_bac_attendance_person` ON (person_id)
- Comment: 'BAC per-session attendance. Links to person_id directly so walk-ins are trackable without prior enrollment.'

---

## Cross-Cutting Concerns

### PII Grants

Neither `programs` nor `missions` contain PII beyond what's already in `core.person`. Extend existing role grants:

```sql
-- app_full: full access
GRANT USAGE ON SCHEMA programs, missions TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA programs, missions TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA programs, missions TO app_full;

-- app_pastoral: read access
GRANT USAGE ON SCHEMA programs, missions TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_pastoral;

-- app_general: read access (no PII tables to revoke)
GRANT USAGE ON SCHEMA programs, missions TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_general;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;
```

### Conventions

Same as Plans 1-2. Migration numbering continues from V042.

### What's NOT in scope

- `education` schema (Plan 3b)
- `staging` schema and migration ETL (Plan 4)
- Heartlink curriculum content management
- BAC completion tracking (explicitly excluded per spec — "BAC has no completion flag")
- Finance/payment tracking (external system)
