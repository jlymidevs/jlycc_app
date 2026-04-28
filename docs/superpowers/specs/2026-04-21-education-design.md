# JLY Church Database — Plan 3b: Education Design

## Goal

Add the `education` schema covering Bible College (formal academic structure, no grades) and ISU (continuous track-based discipleship), plus a shared school lookup.

## Architecture

Single schema, three phases:

1. **Phase 1: School lookup** — 1 table, 2 seeded rows (BIBLE_COLLEGE, ISU)
2. **Phase 2: Bible College (`bc_*`)** — 9 tables: program, cohort, semester, course, course_offering, student, enrollment, completion, class_attendance
3. **Phase 3: ISU (`isu_*`)** — 5 tables: track, student, track_progression, session, session_attendance

Dependencies: `education` → `core` (person, branch) + `membership` (member). No dependencies on `programs`, `missions`, `events`, or `attendance`.

## Tech Stack

Same as Plans 1-3a: PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows.

---

## Phase 1: School Lookup

### New Schema

`CREATE SCHEMA IF NOT EXISTS education;`

### Enums

- `education.school_status` — ACTIVE, INACTIVE

### Tables

#### `education.school`

Lookup. 2 seeded rows.

| Column | Type | Constraints |
|---|---|---|
| `school_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `founded_on` | DATE | |
| `status` | education.school_status | NOT NULL DEFAULT 'ACTIVE' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Trigger: `trg_school_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'School lookup. Seeded: BIBLE_COLLEGE, ISU.'

### Seeds

#### `R__seed_schools.sql`

```
BIBLE_COLLEGE — Bible College
ISU — International Success University
```

ON CONFLICT (code) DO UPDATE SET name, description.

---

## Phase 2: Bible College (`bc_*`)

### Enums

- `education.semester_status` — PLANNED, REGISTRATION, ACTIVE, GRADING, CLOSED
- `education.bc_student_status` — ACTIVE, ON_LEAVE, GRADUATED, WITHDRAWN, DISMISSED
- `education.bc_enrollment_status` — ENROLLED, DROPPED, COMPLETED, WITHDRAWN
- `education.bc_completion_status` — COMPLETED, INCOMPLETE, WITHDRAWN

### Tables

#### `education.bc_program`

Academic program definition.

| Column | Type | Constraints |
|---|---|---|
| `program_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `degree_level` | TEXT | |
| `total_credits` | INT | |
| `duration_years` | INT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Trigger: `trg_bc_program_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Bible College academic program (e.g., "Bachelor of Theology").'

#### `education.bc_cohort`

Student cohort within a program.

| Column | Type | Constraints |
|---|---|---|
| `cohort_id` | BIGSERIAL | PRIMARY KEY |
| `program_id` | BIGINT | NOT NULL, FK → bc_program |
| `name` | TEXT | NOT NULL |
| `starts_on` | DATE | |
| `expected_graduation_on` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bc_cohort_program` ON (program_id)
- Trigger: `trg_bc_cohort_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Bible College cohort (e.g., "BT Class of 2028").'

#### `education.bc_semester`

Academic semester. Shared across all programs.

| Column | Type | Constraints |
|---|---|---|
| `semester_id` | BIGSERIAL | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `academic_year` | TEXT | |
| `term_number` | INT | |
| `starts_on` | DATE | |
| `ends_on` | DATE | |
| `status` | education.semester_status | NOT NULL DEFAULT 'PLANNED' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bc_semester_status` ON (status)
- Trigger: `trg_bc_semester_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Academic semester. Shared across all programs.'

#### `education.bc_course`

Course catalog entry.

| Column | Type | Constraints |
|---|---|---|
| `course_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `title` | TEXT | NOT NULL |
| `credits` | INT | |
| `description` | TEXT | |
| `department` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Trigger: `trg_bc_course_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Bible College course catalog entry (e.g., "THE101 Introduction to Theology").'

#### `education.bc_course_offering`

Course offered in a specific semester.

| Column | Type | Constraints |
|---|---|---|
| `offering_id` | BIGSERIAL | PRIMARY KEY |
| `course_id` | BIGINT | NOT NULL, FK → bc_course |
| `semester_id` | BIGINT | NOT NULL, FK → bc_semester |
| `instructor_member_id` | BIGINT | FK → membership.member |
| `max_seats` | INT | |
| `schedule` | JSONB | NOT NULL DEFAULT '{}' |
| `venue` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(course_id, semester_id)`
- Index: `idx_bc_offering_semester` ON (semester_id)
- Trigger: `trg_bc_offering_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Course offered in a specific semester. schedule JSONB is app-interpreted.'

#### `education.bc_student`

Bible College student record.

| Column | Type | Constraints |
|---|---|---|
| `student_id` | BIGSERIAL | PRIMARY KEY |
| `person_id` | BIGINT | NOT NULL, UNIQUE, FK → core.person |
| `cohort_id` | BIGINT | NOT NULL, FK → bc_cohort |
| `student_number` | TEXT | NOT NULL, UNIQUE |
| `enrolled_on` | DATE | NOT NULL |
| `status` | education.bc_student_status | NOT NULL DEFAULT 'ACTIVE' |
| `graduated_on` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_bc_student_cohort` ON (cohort_id)
- Index: `idx_bc_student_status` ON (status)
- Trigger: `trg_bc_student_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Bible College student. person_id UNIQUE (one student record per person). No branch_id — derived from person/member record.'

#### `education.bc_enrollment`

Student enrollment in a course offering.

| Column | Type | Constraints |
|---|---|---|
| `enrollment_id` | BIGSERIAL | PRIMARY KEY |
| `student_id` | BIGINT | NOT NULL, FK → bc_student ON DELETE CASCADE |
| `offering_id` | BIGINT | NOT NULL, FK → bc_course_offering ON DELETE CASCADE |
| `enrolled_on` | DATE | NOT NULL |
| `status` | education.bc_enrollment_status | NOT NULL DEFAULT 'ENROLLED' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(student_id, offering_id)`
- Index: `idx_bc_enrollment_offering` ON (offering_id)
- Trigger: `trg_bc_enrollment_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'Student enrollment in a course offering.'

#### `education.bc_completion`

Completion record for an enrollment. 1:1 with enrollment.

| Column | Type | Constraints |
|---|---|---|
| `enrollment_id` | BIGINT | PRIMARY KEY, FK → bc_enrollment |
| `status` | education.bc_completion_status | NOT NULL |
| `completed_on` | DATE | |
| `attendance_rate` | NUMERIC | |
| `remarks` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Comment: 'Completion record for a course enrollment. 1:1 with bc_enrollment. No letter grades, no GPA — attendance rate only.'

#### `education.bc_class_attendance`

Per-class attendance tracking. Dedicated (not via events.event).

| Column | Type | Constraints |
|---|---|---|
| `attendance_id` | BIGSERIAL | PRIMARY KEY |
| `offering_id` | BIGINT | NOT NULL, FK → bc_course_offering ON DELETE CASCADE |
| `student_id` | BIGINT | NOT NULL, FK → bc_student ON DELETE CASCADE |
| `class_date` | DATE | NOT NULL |
| `attended` | BOOLEAN | NOT NULL |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(offering_id, student_id, class_date)`
- Index: `idx_bc_class_att_offering` ON (offering_id)
- Index: `idx_bc_class_att_student` ON (student_id)
- Comment: 'Per-class Bible College attendance. Dedicated tracking (not via events schema).'

---

## Phase 3: ISU (`isu_*`)

### Enums

- `education.isu_student_status` — ACTIVE, INACTIVE, COMPLETED

### Tables

#### `education.isu_track`

Ordered progression track.

| Column | Type | Constraints |
|---|---|---|
| `track_id` | BIGSERIAL | PRIMARY KEY |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `order_index` | INT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Trigger: `trg_isu_track_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'ISU learning track. Ordered by order_index for progression.'

#### `education.isu_student`

ISU student record. Continuous enrollment.

| Column | Type | Constraints |
|---|---|---|
| `student_id` | BIGSERIAL | PRIMARY KEY |
| `person_id` | BIGINT | NOT NULL, UNIQUE, FK → core.person |
| `current_track_id` | BIGINT | FK → isu_track |
| `enrolled_on` | DATE | NOT NULL |
| `status` | education.isu_student_status | NOT NULL DEFAULT 'ACTIVE' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_isu_student_track` ON (current_track_id)
- Index: `idx_isu_student_status` ON (status)
- Trigger: `trg_isu_student_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'ISU student. Continuous enrollment, no cohorts/semesters. person_id UNIQUE.'

#### `education.isu_track_progression`

History of track changes.

| Column | Type | Constraints |
|---|---|---|
| `progression_id` | BIGSERIAL | PRIMARY KEY |
| `student_id` | BIGINT | NOT NULL, FK → isu_student ON DELETE CASCADE |
| `from_track_id` | BIGINT | nullable, FK → isu_track |
| `to_track_id` | BIGINT | NOT NULL, FK → isu_track |
| `progressed_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_isu_progression_student` ON (student_id)
- Comment: 'ISU track progression history. from_track_id is NULL for initial enrollment.'

#### `education.isu_session`

Per-branch teaching session.

| Column | Type | Constraints |
|---|---|---|
| `session_id` | BIGSERIAL | PRIMARY KEY |
| `branch_id` | BIGINT | NOT NULL, FK → core.branch |
| `track_id` | BIGINT | NOT NULL, FK → isu_track |
| `topic` | TEXT | |
| `scheduled_at` | TIMESTAMPTZ | |
| `facilitator_member_id` | BIGINT | FK → membership.member |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_isu_session_branch` ON (branch_id)
- Index: `idx_isu_session_track` ON (track_id)
- Trigger: `trg_isu_session_updated_at` BEFORE UPDATE → `set_updated_at()`
- Comment: 'ISU teaching session. Per-branch, per-track.'

#### `education.isu_session_attendance`

Per-session attendance.

| Column | Type | Constraints |
|---|---|---|
| `attendance_id` | BIGSERIAL | PRIMARY KEY |
| `session_id` | BIGINT | NOT NULL, FK → isu_session ON DELETE CASCADE |
| `person_id` | BIGINT | NOT NULL, FK → core.person |
| `attended` | BOOLEAN | NOT NULL |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(session_id, person_id)`
- Index: `idx_isu_attendance_person` ON (person_id)
- Comment: 'ISU per-session attendance. Uses person_id (not student_id) — anyone can attend.'

---

## Cross-Cutting Concerns

### Role Grants

No PII tables in `education`. Extend existing roles:

```sql
GRANT USAGE ON SCHEMA education TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA education TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA education TO app_full;

GRANT USAGE ON SCHEMA education TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_pastoral;

GRANT USAGE ON SCHEMA education TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_general;

ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;
```

### Conventions

Same as Plans 1-3a. Migration numbering continues from V049.

### What's NOT in scope

- `staging` schema and migration ETL (Plan 4)
- Grade/GPA tracking (explicitly excluded per spec)
- Curriculum content management
- ISU track seed data (user will define tracks post-implementation)
- Course prerequisite tracking
