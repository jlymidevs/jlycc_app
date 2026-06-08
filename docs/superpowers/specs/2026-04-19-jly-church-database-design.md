# JLY Church Database — Design Specification

- **Date:** 2026-04-19
- **Project:** Jesus Loves You (JLY) City Church — Database Design
- **Engine:** PostgreSQL on Google Cloud SQL (multi-tenant)
- **Status:** Approved design, ready for implementation planning

---

## 1. Context & Goals

JLY operates a multi-branch church (Philippines local clusters + international branches, 10K+ members across many sites). The database is a **comprehensive church management system** covering members, ministries, events, attendance, programs, missions, and education — but explicitly **excluding finance** (handled by a separate accounting system).

Today's data lives in Google Sheets. This design replaces it with a relational system on Cloud SQL that supports operational queries (rosters, check-ins, pastoral care lists), historical reporting on member journeys and ministry growth, and a unified data layer for future mobile/web/admin apps.

### Design priorities
- **Breadth over depth** in version one — every major domain modeled, but only with what's actually used today.
- **Track key transitions** (lifecycle stage, ministry membership, branch transfers, role assignments) so historical reporting is possible. No full per-field audit trail.
- **Modular by bounded context** — separate PostgreSQL schemas per domain so the system can grow with the team and permissions can be scoped per module.

---

## 2. Decisions Summary

| Topic | Decision |
|---|---|
| Database engine | PostgreSQL on Google Cloud SQL (multi-tenant single DB) |
| Schema organization | One PostgreSQL schema per bounded context (`core`, `membership`, `ministries`, `events`, `attendance`, `programs`, `missions`, `education`, `staging`) |
| Member model | Hybrid — exclusive lifecycle stage (FTV → DFL/OGV/RA → Regular Member) + stackable roles (Pastor, Admin Staff, PCM, etc.) |
| Multi-branch | `branch_id` on every relevant entity; org-wide reporting from a single DB |
| Ministries | 3-level hierarchy: Network → Ministry → Branch Chapter (per-branch instance) |
| Network terminology | "Network" (Eagles, Wind, Lead Takers) is the master grouping |
| History tracking | Track key transitions only (lifecycle, ministry, branch, role, kinship, household, ISU track) |
| Family/household | Full kinship graph (spouse/parent/sibling) + household entity |
| Attendance | Per-person check-in + on-the-spot FTV intake |
| Programs/missions/schools | Dedicated tables per type (per user preference for clarity over abstraction) |
| Mission Scholars | JLY members only (sponsored by other JLY members) |
| BAC | "Bless A Community" — outreach + discipleship-like (members AND non-members; curriculum present but completion not required) |
| Bible College | Formal academic structure; completion + attendance rate, no letter grades or GPA |
| ISU | "International Success University" — Sunday-school-style continuous discipleship; track-based; attendance-driven |
| Finance | Out of scope (handled in external accounting system) |
| Foundation | Deferred to a later phase |
| Scale | XL — 10K+ members, many international branches |
| Migration | One-shot from Google Sheets via `staging` schema |
| Historical attendance | Not migrated; new system starts fresh on cutover day |
| Cutover strategy | One-shot at a chosen date |
| PII audit | Deferred to phase 2 |
| App access roles | Two roles: `app_general` (no PII) and `app_pastoral` (full read) |
| Person deletion | Soft-delete only (no anonymization at this stage) |

---

## 3. Schema Architecture

```
core            ←  foundation; everyone FKs into person, branch, region
membership      ←  who is a member, what stage, what role
ministries      ←  Network → Ministry → Branch Chapter → memberships
events          ←  what's happening, where, when (incl. registration)
attendance      ←  check-ins (partitioned by month) + FTV intake + child check-in
programs        ←  Heartlink (cohort + sessions + attendance)
missions        ←  Scholars (member sponsorship), BAC (outreach + curriculum)
education       ←  Bible College (formal) + ISU (continuous, track-based)
staging         ←  raw imports from Google Sheets (migration only)
foundation      ←  reserved slot, not built in v1
reports         ←  reserved slot for future denormalized read models
```

### Cross-schema dependency rules
- `core` is depended on by all schemas.
- `membership` is depended on by `ministries`, `attendance`, `programs`, `missions`, `education`.
- `events` is depended on by `attendance`.
- No upward FKs; no cycles.

---

## 4. Schema Details

### 4.1 `core`

Foundation schema. Holds physical persons (independent of membership), branches, regions, households, and the kinship graph.

| Table | Purpose | Key columns |
|---|---|---|
| `region` | Local clusters and international countries | `region_id PK`, `code`, `name`, `type{LOCAL_CLUSTER, INTERNATIONAL_COUNTRY}`, `parent_region_id` (nullable) |
| `branch` | Every JLY location | `branch_id PK`, `code` (unique, e.g., "MNL-HQ"), `name`, `region_id FK`, `type{LOCAL, INTERNATIONAL}`, `country_code`, `timezone`, `primary_address_id FK`, `launched_on`, `status{ACTIVE, PLANTING, CLOSED}` |
| `person` | Every individual (members, FTVs, students, BAC participants — all start here) | `person_id PK`, `first_name`, `middle_name`, `last_name`, `suffix`, `preferred_name`, `date_of_birth`, `gender`, `marital_status`, `nationality`, `profile_photo_url`, `notes`, `created_at`, `updated_at`, `deleted_at` (soft delete) |
| `contact_info` | Phone, email, etc. — multiple per person | `contact_id PK`, `person_id FK`, `type{MOBILE, EMAIL, LANDLINE, MESSENGER}`, `value`, `is_primary`, `consented_at`, `verified_at` |
| `address` | Reusable physical addresses | `address_id PK`, `line1`, `line2`, `city`, `province`, `postal_code`, `country_code`, `geom` (optional PostGIS POINT) |
| `person_address` | Person ↔ address with type and validity | `person_id FK`, `address_id FK`, `type{HOME, WORK, MAILING}`, `valid_from`, `valid_to` |
| `household` | Operational family unit | `household_id PK`, `branch_id FK`, `name` ("The Cruz Family"), `primary_address_id FK`, `head_of_household_id FK → person` |
| `household_member` | Person ↔ household, with history | `household_id FK`, `person_id FK`, `role_in_household{HEAD, SPOUSE, CHILD, OTHER}`, `joined_at`, `left_at` |
| `kinship` | Spouse / parent / sibling graph | `kinship_id PK`, `person_id FK`, `related_person_id FK`, `relationship{SPOUSE, PARENT_OF, CHILD_OF, SIBLING, OTHER}`, `valid_from`, `valid_to`, `notes` |

**Key rules:**
- A `person` can exist independently of any `member` record (e.g., FTVs at the door, children, BAC non-member participants, BC applicants).
- Kinship stored one direction per relationship; a `kinship_bidirectional` view auto-flips for queries.
- Address history retained via `person_address.valid_from/valid_to`.

### 4.2 `membership`

Who is a member, what lifecycle stage they're in, what roles they hold.

| Table | Purpose | Key columns |
|---|---|---|
| `member` | Person + branch + current stage | `member_id PK`, `person_id FK UNIQUE`, `branch_id FK` (current home), `member_code` (e.g., "MNL-2024-001245"), `current_stage`, `joined_at`, `regular_member_since` (nullable), `status{ACTIVE, INACTIVE, TRANSFERRED, DECEASED}` |
| `lifecycle_stage` | Lookup of stages | `stage_code PK{FTV, DFL, OGV, RA, REGULAR_MEMBER}`, `name`, `description`, `order_index`, `is_terminal` |
| `lifecycle_stage_history` | Every stage transition | `history_id PK`, `member_id FK`, `from_stage`, `to_stage`, `changed_at`, `effective_from`, `changed_by_person_id FK`, `reason` |
| `branch_membership_history` | Every branch transfer | `member_id FK`, `from_branch_id FK`, `to_branch_id FK`, `transferred_at`, `effective_from`, `reason` |
| `role` | Lookup of roles | `role_id PK`, `code{PASTOR, REGIONAL_DIRECTOR, ADMIN_STAFF, PCM, ...}` (note: NOT `LEAD_TAKER` — that's a Network), `name`, `description`, `is_pastoral` |
| `member_role` | Stackable role assignments with history | `member_role_id PK`, `member_id FK`, `role_id FK`, `branch_id FK` (nullable), `region_id FK` (nullable, for Regional Director), `assigned_at`, `ended_at`, `assigned_by_person_id FK`, `notes` |
| `regular_member_application` | Application + criteria checklist | `application_id PK`, `member_id FK`, `submitted_at`, `reviewed_at`, `reviewed_by_person_id FK`, `status{PENDING, APPROVED, REJECTED, WITHDRAWN}`, `criteria_checklist JSONB`, `decision_notes` |
| `pastoral_care_assignment` | PCM ↔ cared-for member | `assignment_id PK`, `carer_member_id FK`, `assigned_member_id FK`, `assigned_at`, `ended_at`, `status{ACTIVE, ENDED, REASSIGNED}`, `notes` |

**Key rules:**
- `member.current_stage` is denormalized for query speed; `lifecycle_stage_history` is the source of truth.
- `regular_member_application.criteria_checklist` is JSONB so the criteria can evolve without schema migrations.
- Partial unique index on `pastoral_care_assignment(assigned_member_id) WHERE ended_at IS NULL` enforces "at most one active PCM per member".

### 4.3 `ministries`

3-level hierarchy: Network → Ministry → Branch Chapter.

| Table | Purpose | Key columns |
|---|---|---|
| `network` | Top-level groupings | `network_id PK`, `code`, `name`, `description`, `founded_on`. Seeded with Eagles, Wind, Lead Takers. |
| `ministry` | The actual unit (Move, CCEM, LT Pro, etc.) | `ministry_id PK`, `network_id FK`, `code`, `name`, `description`, `target_demographic`, `founded_on`. ~16 rows. |
| `ministry_chapter` | Per-branch instance | `chapter_id PK`, `ministry_id FK`, `branch_id FK`, `launched_on`, `status{ACTIVE, PAUSED, CLOSED}`. `UNIQUE(ministry_id, branch_id)`. |
| `ministry_membership` | Member ↔ chapter, with leadership info merged in | `membership_id PK`, `chapter_id FK`, `member_id FK`, `joined_at`, `ended_at`, `ended_reason`, `is_leader BOOLEAN`, `leader_role{HEAD, ASSISTANT_HEAD, COORDINATOR}` (nullable, only when `is_leader=true`) |

**Key rules:**
- A member may belong to multiple chapters across multiple networks simultaneously.
- Hierarchy depth is fixed at exactly 2 (Network → Ministry); no nested sub-ministries.

### 4.4 `events`

What's happening, where, when. Includes registration for big events.

| Table | Purpose | Key columns |
|---|---|---|
| `event_category` | Lookup | `category_code PK{SEASONAL, REGULAR}`, `name` |
| `event_type` | Lookup of event types | `event_type_id PK`, `code`, `name`, `category_code FK`, `network_id FK` (nullable), `ministry_id FK` (nullable), `typical_duration_minutes`. Seeded: GNY, CAMP_MEETING, COUPLES, MISSIONS_MONTH, APC, MID_YEAR_PC, ANNIVERSARY, CHRISTMAS, SUNDAY_SERVICE, FRIDAY_PRAYER, LT_CONNECT, KINGDOM_KIDS, LT_YOUTH, LT_PRO, HARPS_AND_BOWLS. |
| `event_series` | Recurring schedule | `series_id PK`, `event_type_id FK`, `branch_id FK` (nullable for org-wide), `name`, `recurrence_pattern{DAILY, WEEKLY, MONTHLY, YEARLY}`, `recurrence_config JSONB`, `starts_on`, `ends_on`, `status` |
| `event` | Concrete instance | `event_id PK`, `event_type_id FK`, `series_id FK` (nullable), `branch_id FK` (nullable for org-wide events like APC), `host_branch_id FK` (nullable, physical host), `name`, `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`, `venue`, `expected_attendance`, `status{SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED}` |
| `event_organizer` | Who's running it | `event_id FK`, `member_id FK`, `role`, `added_at` |
| `event_registration` | RSVP for big events (Camp Meeting, APC, etc.) | `registration_id PK`, `event_id FK`, `person_id FK`, `registered_at`, `registered_by_member_id FK`, `status{REGISTERED, CONFIRMED, WAITLISTED, CANCELLED, NO_SHOW}`, `accommodation_required BOOLEAN`, `dietary_requirements`, `group_size`, `emergency_contact_name`, `emergency_contact_phone`, `payment_reference` (text only — finance is external), `notes` |

### 4.5 `attendance`

The high-volume schema. Partitioned by month.

| Table | Purpose | Key columns |
|---|---|---|
| `check_in` | Per-person check-in (PARTITIONED by month on `checked_in_at`) | `check_in_id BIGSERIAL`, `event_id FK`, `person_id FK → core.person`, `branch_id FK` (denormalized for partition pruning), `checked_in_at TIMESTAMPTZ`, `check_in_method{SELF, USHER, BULK_IMPORT}`, `captured_by_member_id FK`, `ftv_capture_id FK` (nullable) |
| `visitor_capture` | FTV intake form | `ftv_capture_id PK`, `person_id FK` (the new person), `event_id FK`, `branch_id FK`, `captured_at`, `captured_by_member_id FK`, `invited_by_person_id FK`, `consent_to_contact BOOLEAN`, `intake_notes`, `converted_member_id FK` (nullable, set when FTV becomes a member) |
| `child_check_in` | Extension for child safety | `check_in_id PK FK → check_in`, `parent_check_in_id FK → check_in`, `pickup_code` (e.g., "MNL-K-9472"), `allergies`, `picked_up_at`, `picked_up_by_person_id FK`, `pickup_verified_by_member_id FK`. Constraint: `UNIQUE(event_id, pickup_code)` enforced via composite index that joins back through `check_in.event_id`. |
| `attendance_summary` | Materialized view, refreshed nightly | Pre-aggregated per event/branch/ministry/week for dashboard performance |

**Key rules:**
- `check_in.person_id` (not `member_id`) so FTV check-ins work without a member record.
- Native PostgreSQL declarative range partitioning, monthly. New partition created by cron one month in advance. Partitions older than 3 years detached and archived to cold storage.
- `child_check_in` is an extension (one-to-one PK FK) so the main `check_in` table stays lean for the 95% adult case.

### 4.6 `programs` (Heartlink)

| Table | Purpose | Key columns |
|---|---|---|
| `heartlink_cohort` | Cohort instance | `cohort_id PK`, `branch_id FK`, `name` ("Manila Heartlink Q1 2026"), `starts_on`, `ends_on`, `session_count`, `facilitator_member_id FK`, `status{PLANNING, ACTIVE, COMPLETED, CANCELLED}` |
| `heartlink_enrollment` | Person ↔ cohort | `enrollment_id PK`, `cohort_id FK`, `person_id FK`, `enrolled_at`, `status{ENROLLED, ACTIVE, COMPLETED, DROPPED}`, `completion_date`, `notes`, `UNIQUE(cohort_id, person_id)` |
| `heartlink_session` | Session within cohort | `session_id PK`, `cohort_id FK`, `session_number`, `topic`, `scheduled_at TIMESTAMPTZ`, `duration_minutes`, `facilitator_member_id FK` (nullable, override), `venue`, `notes` |
| `heartlink_session_attendance` | Per-session attendance | `attendance_id PK`, `session_id FK`, `enrollment_id FK`, `attended BOOLEAN`, `arrived_at`, `notes`, `UNIQUE(session_id, enrollment_id)` |

### 4.7 `missions` (Scholars + BAC)

| Table | Purpose | Key columns |
|---|---|---|
| `scholar_program` | Scholarship program definition | `program_id PK`, `name`, `starts_on`, `ends_on`, `description`, `status` |
| `scholarship_award` | Award to JLY member | `award_id PK`, `program_id FK`, `member_id FK` (must be JLY member), `awarded_at`, `term`, `amount NUMERIC` (informational), `school_id FK → education.school` (nullable, if internal), `external_school_name` (if external), `sponsor_member_id FK` (nullable), `status{AWARDED, ACTIVE, COMPLETED, REVOKED}`, `notes` |
| `bac_initiative` | "Bless A Community" outreach campaign | `initiative_id PK`, `branch_id FK`, `name` ("Bless Tondo 2026"), `target_community`, `starts_on`, `ends_on`, `coordinator_member_id FK`, `status{PLANNING, ACTIVE, COMPLETED, CANCELLED}` |
| `bac_session` | Session within an initiative | `session_id PK`, `initiative_id FK`, `session_number`, `topic` (free text — basic Christianity topics), `scheduled_at`, `duration_minutes`, `venue`, `facilitator_member_id FK` |
| `bac_participant` | Member or non-member who joined | `participant_id PK`, `initiative_id FK`, `person_id FK` (members + non-members both via `core.person`), `joined_at`, `left_at`, `role{LEADER, FACILITATOR, PARTICIPANT, VOLUNTEER}` |
| `bac_session_attendance` | Per-session attendance (open to walk-ins) | `attendance_id PK`, `session_id FK`, `person_id FK`, `attended BOOLEAN`, `attended_as{ENROLLED, WALK_IN, FACILITATOR}`, `notes` |

**Key rules:**
- Scholars are JLY members only; sponsored by other JLY members (no external donors).
- BAC has no completion flag — completion is not required.
- BAC attendance ties to `person_id` directly so walk-ins are trackable without prior enrollment.

### 4.8 `education` (Bible College + ISU)

| Table | Purpose | Key columns |
|---|---|---|
| `school` | Lookup | `school_id PK`, `code`, `name`, `description`, `founded_on`, `status`. Two rows: BIBLE_COLLEGE, ISU. |

#### Bible College (`bc_*`) — formal academic structure, no grading

| Table | Key columns |
|---|---|
| `bc_program` | `program_id PK`, `code`, `name` ("Bachelor of Theology"), `degree_level`, `total_credits`, `duration_years` |
| `bc_cohort` | `cohort_id PK`, `program_id FK`, `name`, `starts_on`, `expected_graduation_on` |
| `bc_semester` | `semester_id PK`, `name` ("Sem 1 AY 2025-2026"), `academic_year`, `term_number`, `starts_on`, `ends_on`, `status{PLANNED, REGISTRATION, ACTIVE, GRADING, CLOSED}` |
| `bc_course` | `course_id PK`, `code` ("THE101"), `title`, `credits`, `description`, `department` |
| `bc_course_offering` | `offering_id PK`, `course_id FK`, `semester_id FK`, `instructor_member_id FK`, `max_seats`, `schedule JSONB`, `venue`, `UNIQUE(course_id, semester_id)` |
| `bc_student` | `student_id PK`, `person_id FK UNIQUE`, `cohort_id FK`, `student_number` ("BC-2024-0042"), `enrolled_on`, `status{ACTIVE, ON_LEAVE, GRADUATED, WITHDRAWN, DISMISSED}`, `graduated_on`. **No `branch_id`** — students can come from any branch (derived from member record). |
| `bc_enrollment` | `enrollment_id PK`, `student_id FK`, `offering_id FK`, `enrolled_on`, `status{ENROLLED, DROPPED, COMPLETED, WITHDRAWN}`, `UNIQUE(student_id, offering_id)` |
| `bc_completion` | `enrollment_id FK UNIQUE`, `status{COMPLETED, INCOMPLETE, WITHDRAWN}`, `completed_on`, `attendance_rate NUMERIC`, `remarks`. **No letter grades, no GPA.** |
| `bc_class_attendance` | `attendance_id PK`, `offering_id FK`, `student_id FK`, `class_date`, `attended BOOLEAN`, `notes`. Dedicated (not via `events.event`). |

#### ISU (`isu_*`) — continuous, track-based, attendance-driven

| Table | Key columns |
|---|---|
| `isu_track` | `track_id PK`, `code`, `name` ("New Believers", "Foundations", "Spiritual Growth Level 2"), `description`, `order_index` |
| `isu_student` | `student_id PK`, `person_id FK UNIQUE`, `current_track_id FK`, `enrolled_on`, `status{ACTIVE, INACTIVE, COMPLETED}`. **Continuous, no cohorts/semesters.** |
| `isu_track_progression` | `progression_id PK`, `student_id FK`, `from_track_id FK` (nullable), `to_track_id FK`, `progressed_at`, `notes` |
| `isu_session` | `session_id PK`, `branch_id FK`, `track_id FK`, `topic`, `scheduled_at`, `facilitator_member_id FK` |
| `isu_session_attendance` | `attendance_id PK`, `session_id FK`, `person_id FK`, `attended BOOLEAN`, `notes` |

---

## 5. Cross-cutting Conventions

### 5.1 Identifiers and timestamps
- Surrogate PKs: `BIGSERIAL` (or `IDENTITY` on Postgres ≥ 14).
- Natural codes as `UNIQUE` columns where humans refer to entities (e.g., `branch.code`, `bc_student.student_number`).
- No composite PKs except junction tables.
- All timestamps `TIMESTAMPTZ` (never `TIMESTAMP`). Multiple international branches require timezone-aware storage.
- Every table: `created_at TIMESTAMPTZ DEFAULT now()`. Mutable tables also `updated_at TIMESTAMPTZ` (managed by trigger).

### 5.2 Soft delete
- `deleted_at TIMESTAMPTZ NULL` on PII-bearing or relationship-bearing tables (`person`, `member`, `household`, etc.). No anonymization at this stage.
- Lookup tables use `is_active BOOLEAN` instead of soft-delete.
- Operational queries filter `WHERE deleted_at IS NULL`. Each soft-deleted table gets an `_active` view that wraps this filter.

### 5.3 History pattern
Standard shape for `*_history` tables:
```
history_id PK
parent_entity_id FK
changed_at TIMESTAMPTZ
effective_from DATE
changed_by_person_id FK
reason TEXT
+ before/after snapshot columns specific to what changed
```

A trigger on the parent table keeps the history table in sync on update. Application code does not write to history tables directly.

Used for: lifecycle stage changes, branch transfers, ministry membership, role assignments, ISU track progression, household membership, kinship.

### 5.4 Enums
- **Native PG `ENUM` type** for values that are truly fixed and rarely change: `gender`, `marital_status`, `event_category`, `check_in_method`, `attended_as`, etc.
- **Lookup tables** for values that users select in the app or that may gain attributes later: `role`, `lifecycle_stage`, `event_type`, `network`, `school`, `isu_track`.

### 5.5 Indexes
- `attendance.check_in` (per partition): `(event_id)`, `(person_id, checked_in_at DESC)`, `(branch_id, checked_in_at DESC)`.
- `member`: `(branch_id, current_stage)`, `(person_id) UNIQUE`.
- `ministry_membership`: `(member_id) WHERE ended_at IS NULL` (partial), `(chapter_id, ended_at)`.
- `lifecycle_stage_history`: `(member_id, changed_at DESC)`.
- All `*_history` tables: composite `(parent_id, changed_at)`.
- **All FK columns get an explicit index** — Postgres does not auto-index FKs.

### 5.6 PII and access control
- Column-level grants on PII columns (`core.contact_info`, `core.address`, `person.date_of_birth`, `person.notes`).
- Two app DB roles: **`app_general`** (no PII access) and **`app_pastoral`** (full read).
- Cloud SQL CMEK for at-rest encryption.
- PII access audit logging: **deferred to phase 2**.

### 5.7 Schema-level permissions
Each PostgreSQL schema gets dedicated DB roles:
- `education_writer` — INSERT/UPDATE only in `education.*`
- `attendance_writer` — INSERT/UPDATE only in `attendance.*` (used by check-in apps/kiosks)
- `app_full` — full access for the main backend
- `analytics_reader` — read-only on `reports.*` (future schema)

### 5.8 Partitioning
- `attendance.check_in`: declarative range partitioning by `checked_in_at`, monthly. New partition created by cron one month in advance. Partitions older than 3 years detached and archived to cold storage.
- All other tables: not partitioned at this scale.

### 5.9 Naming
- `snake_case` for all identifiers.
- Singular table names (`member`, not `members`).
- FK columns: `<referenced_table>_id` (e.g., `branch_id`).
- History tables: `<entity>_history`.
- Junction tables: `<a>_<b>` alphabetical (e.g., `household_member`, `member_role`).

---

## 6. Migration Plan

### 6.1 `staging` schema design
One table per source Google Sheet, all columns `TEXT`:
```
staging.<sheet_name>:
  staging_id BIGSERIAL PK
  source_row_number INT
  imported_at TIMESTAMPTZ DEFAULT now()
  import_batch_id UUID
  raw_<col> TEXT  (one per source column)
  validation_errors JSONB
  promoted_to_id BIGINT  (set when row lands in operational table)
  promoted_at TIMESTAMPTZ
```

Every operational row is traceable back to a source sheet/row.

### 6.2 Phased pipeline
1. **Load** — Python script (pandas + psycopg2 + `gspread`) bulk-loads sheets into `staging.*`. Idempotent per batch.
2. **Cleanse** — SQL UPDATEs in staging: trim whitespace, normalize phone formats, parse dates, etc.
3. **Validate** — fills `validation_errors JSONB` with rule violations. Bad rows stay in staging until fixed in source AND re-loaded, or resolved manually.
4. **Promote** — INSERT into operational schemas in FK-dependency order. Sets `promoted_to_id`.

### 6.3 FK-respecting promotion order
1. `core.region` → `core.branch`
2. `core.address` → `core.person` → `core.contact_info` → `core.household` → `core.household_member` → `core.kinship`
3. `membership.role` (seeded) → `membership.lifecycle_stage` (seeded) → `membership.member` → `member_role` → `lifecycle_stage_history` (back-fill if available)
4. `ministries.network` (3 seeded rows) → `ministry` (~16 seeded) → `ministry_chapter` (per-branch) → `ministry_membership`
5. `events.event_type` (seeded) → `event` (only forward-looking events; historical attendance NOT migrated)
6. `programs.heartlink_*`, `missions.*`, `education.*` — independent of attendance

### 6.4 Person deduplication
Approach for the multi-sheet, name-variation, phone-change problem:

- Load all candidate persons into `staging.person_candidate`.
- Run blocking + fuzzy match: blocking key = `last_name + first_initial + phone-last-4`; Levenshtein on names within blocks.
- Auto-merge above 95% confidence.
- Queue 70-95% confidence for manual review in `staging.person_merge_review`.
- Below 70% = treat as distinct.
- Manual review tool: simple admin UI showing side-by-side candidate pairs.

### 6.5 Cutover
- **One-shot cutover** at a chosen date. Load all sheets, validate, promote, switch the church to the new system.
- **Historical attendance is NOT migrated.** New system starts with empty `attendance.check_in` on cutover day.
- Other historical data (member lifecycle history, ministry membership history) migrated where present in sheets.

### 6.6 Tooling
- Python ETL script for load + cleanse + validate.
- SQL scripts for the promote phase (declarative, transactional).
- No `dbt` (one-shot migration; ongoing transformations not yet justified).

---

## 7. Out of Scope (v1)

- **Finance / giving / donations** — handled in external accounting system; no tables for tithes, pledges, expenses, or budgets.
- **PII access audit logging** — deferred to phase 2.
- **Anonymization on person delete** — soft delete only; no scrubbing routine in v1.
- **`reports` schema** (denormalized read models / CQRS-light) — reserved slot; build in year 2 once actual reporting needs are clear.
- **`foundation` schema** — reserved slot; the JLY Foundation (separate legal entity) is not modeled in v1.
- **Historical attendance migration** — new system starts fresh on cutover day.
- **Sub-ministries below the Ministry level** — confirmed not needed; if Kingdom Kids ever needs age-group splits, revisit.
- **Application-level concerns** — UI, mobile/web apps, Firebase Auth integration, notification system. Out of scope for the database design.

---

## 8. Deferred and Open Questions for Phase 2+

- **Foundation module** — once scoped, will live in a `foundation` schema. Likely needs: beneficiaries (non-member individuals receiving aid), partner organizations, projects.
- **`reports` schema** — denormalized read models for dashboards and analytics, refreshed on a schedule.
- **PII audit logging** — when compliance or pastoral-trust requirements demand it.
- **Per-field audit trail** — if the church ever needs full forensic auditing.
- **Multi-language support** — names, transliterations for international branches.
- **Integration touchpoints** — Google Workspace (Calendar for events?), notification systems, mobile check-in apps.

---

## 9. Implementation Notes

The implementation plan (separate document) should sequence schema creation in dependency order and create the seeded reference data (networks, ministries, lifecycle stages, roles, event types, schools, ISU tracks) as part of the initial migration. The `staging` schema and the migration tooling are independent workstreams that can run in parallel with the operational schema build-out.
