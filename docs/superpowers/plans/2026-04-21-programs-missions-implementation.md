# Programs + Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `programs` (Heartlink discipleship) and `missions` (Scholars + BAC outreach) schemas with 10 tables, role grants, and end-to-end smoke test.

**Architecture:** Two phases — programs (4 tables) then missions (6 tables). No FK dependencies between schemas. Both depend on core + membership from Plan 1. Continues from Plan 2 (V042, 195 tests).

**Tech Stack:** PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows.

---

## File Structure

### Migrations (V043–V049)

| File | Responsibility |
|---|---|
| `V043__create_programs_missions_schemas.sql` | CREATE SCHEMA programs, missions |
| `V044__programs_heartlink_cohort_enrollment.sql` | cohort_status + enrollment_status enums, heartlink_cohort + heartlink_enrollment tables |
| `V045__programs_heartlink_session_attendance.sql` | heartlink_session + heartlink_session_attendance tables |
| `V046__missions_scholar_award.sql` | program_status + award_status enums, scholar_program + scholarship_award tables |
| `V047__missions_bac_initiative_session.sql` | initiative_status enum, bac_initiative + bac_session tables |
| `V048__missions_bac_participant_attendance.sql` | bac_role + attendance_role enums, bac_participant + bac_session_attendance tables |
| `V049__plan3a_roles_and_grants.sql` | Extend app_full/app_pastoral/app_general to programs + missions |

### Tests

| File | What it tests |
|---|---|
| `35_programs_cohort_enrollment.sql` | cohort + enrollment tables, uniqueness, FK, enum |
| `36_programs_session_attendance.sql` | session + attendance, unique(session, enrollment) |
| `37_missions_scholar_award.sql` | scholar_program + award, member-only FK |
| `38_missions_bac_initiative_session.sql` | bac_initiative + session |
| `39_missions_bac_participant_attendance.sql` | participant + attendance, walk-in pattern, unique(session, person) |
| `40_plan3a_roles.sql` | Role grants verification |

---

## Phase 1: `programs`

### Task 1: Create schemas + `heartlink_cohort` + `heartlink_enrollment`

**Files:**
- Create: `db/migrations/V043__create_programs_missions_schemas.sql`
- Create: `db/migrations/V044__programs_heartlink_cohort_enrollment.sql`
- Create: `db/tests/35_programs_cohort_enrollment.sql`

- [ ] **Step 1: Write `db/tests/35_programs_cohort_enrollment.sql`**

```sql
BEGIN;
SELECT plan(8);

SELECT has_schema('programs', 'programs schema exists');
SELECT has_table('programs', 'heartlink_cohort', 'cohort table exists');
SELECT has_table('programs', 'heartlink_enrollment', 'enrollment table exists');
SELECT has_fk('programs', 'heartlink_cohort', 'cohort has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO programs.heartlink_cohort (branch_id, name, facilitator_member_id, status)
  VALUES (:branch_id, 'Manila Q1 2026', :member_id, 'ACTIVE')
  RETURNING cohort_id \gset
SELECT pass('cohort insert succeeds');

INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id);
SELECT pass('enrollment insert succeeds');

-- Duplicate enrollment should fail
PREPARE dup_enroll AS
  INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id);
SELECT throws_ok('dup_enroll', '23505', NULL, 'duplicate (cohort, person) rejected');

SELECT throws_ok(
  $$INSERT INTO programs.heartlink_cohort (branch_id, name, status)
    VALUES (1, 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid cohort_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V043__create_programs_missions_schemas.sql`**

```sql
CREATE SCHEMA IF NOT EXISTS programs;
CREATE SCHEMA IF NOT EXISTS missions;

COMMENT ON SCHEMA programs IS 'Heartlink discipleship cohorts, enrollments, sessions, attendance.';
COMMENT ON SCHEMA missions IS 'Scholars program and BAC (Bless A Community) outreach.';
```

- [ ] **Step 4: Write `db/migrations/V044__programs_heartlink_cohort_enrollment.sql`**

```sql
CREATE TYPE programs.cohort_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE programs.enrollment_status AS ENUM ('ENROLLED', 'ACTIVE', 'COMPLETED', 'DROPPED');

CREATE TABLE programs.heartlink_cohort (
  cohort_id              BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                   TEXT NOT NULL,
  starts_on              DATE,
  ends_on                DATE,
  session_count          INT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  status                 programs.cohort_status NOT NULL DEFAULT 'PLANNING',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartlink_cohort_branch ON programs.heartlink_cohort(branch_id);
CREATE INDEX idx_heartlink_cohort_status ON programs.heartlink_cohort(status);

CREATE TRIGGER trg_heartlink_cohort_updated_at
  BEFORE UPDATE ON programs.heartlink_cohort
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_cohort IS 'Heartlink discipleship cohort instance (e.g., "Manila Heartlink Q1 2026").';

CREATE TABLE programs.heartlink_enrollment (
  enrollment_id  BIGSERIAL PRIMARY KEY,
  cohort_id      BIGINT NOT NULL REFERENCES programs.heartlink_cohort(cohort_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         programs.enrollment_status NOT NULL DEFAULT 'ENROLLED',
  completion_date DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT heartlink_enrollment_unique UNIQUE (cohort_id, person_id)
);

CREATE INDEX idx_heartlink_enrollment_person ON programs.heartlink_enrollment(person_id);

CREATE TRIGGER trg_heartlink_enrollment_updated_at
  BEFORE UPDATE ON programs.heartlink_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_enrollment IS 'Person ↔ Heartlink cohort. Uses person_id so non-members can enroll.';
```

- [ ] **Step 5: Apply and re-run tests**

```bash
cd db && docker compose run --rm flyway migrate && ./tests/run_tests.sh
```

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V043__create_programs_missions_schemas.sql \
        db/migrations/V044__programs_heartlink_cohort_enrollment.sql \
        db/tests/35_programs_cohort_enrollment.sql
git commit -m "feat(db): add programs schema with heartlink_cohort and heartlink_enrollment"
```

---

### Task 2: `heartlink_session` + `heartlink_session_attendance`

**Files:**
- Create: `db/migrations/V045__programs_heartlink_session_attendance.sql`
- Create: `db/tests/36_programs_session_attendance.sql`

- [ ] **Step 1: Write `db/tests/36_programs_session_attendance.sql`**

```sql
BEGIN;
SELECT plan(6);

SELECT has_table('programs', 'heartlink_session', 'session table exists');
SELECT has_table('programs', 'heartlink_session_attendance', 'attendance table exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

INSERT INTO programs.heartlink_cohort (branch_id, name, status)
  VALUES (:branch_id, 'Test Cohort', 'ACTIVE') RETURNING cohort_id \gset
INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id) RETURNING enrollment_id \gset
INSERT INTO programs.heartlink_session (cohort_id, session_number, topic)
  VALUES (:cohort_id, 1, 'Introduction') RETURNING session_id \gset
SELECT pass('session insert succeeds');

INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:session_id, :enrollment_id, true);
SELECT pass('attendance insert succeeds');

-- Duplicate (session, enrollment) should fail
PREPARE dup_att AS
  INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:session_id, :enrollment_id, false);
SELECT throws_ok('dup_att', '23505', NULL, 'duplicate (session, enrollment) rejected');

SELECT col_not_null('programs', 'heartlink_session_attendance', 'attended', 'attended NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V045__programs_heartlink_session_attendance.sql`**

```sql
CREATE TABLE programs.heartlink_session (
  session_id             BIGSERIAL PRIMARY KEY,
  cohort_id              BIGINT NOT NULL REFERENCES programs.heartlink_cohort(cohort_id) ON DELETE CASCADE,
  session_number         INT NOT NULL,
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  duration_minutes       INT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  venue                  TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartlink_session_cohort ON programs.heartlink_session(cohort_id);

CREATE TRIGGER trg_heartlink_session_updated_at
  BEFORE UPDATE ON programs.heartlink_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_session IS 'Session within a Heartlink cohort.';

CREATE TABLE programs.heartlink_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES programs.heartlink_session(session_id) ON DELETE CASCADE,
  enrollment_id  BIGINT NOT NULL REFERENCES programs.heartlink_enrollment(enrollment_id) ON DELETE CASCADE,
  attended       BOOLEAN NOT NULL,
  arrived_at     TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT heartlink_attendance_unique UNIQUE (session_id, enrollment_id)
);

CREATE INDEX idx_heartlink_attendance_enrollment ON programs.heartlink_session_attendance(enrollment_id);

COMMENT ON TABLE programs.heartlink_session_attendance IS 'Per-session Heartlink attendance. Links to enrollment (must be enrolled to track attendance).';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V045__programs_heartlink_session_attendance.sql \
        db/tests/36_programs_session_attendance.sql
git commit -m "feat(db): add heartlink_session and heartlink_session_attendance"
```

---

## Phase 2: `missions`

### Task 3: `missions.scholar_program` + `missions.scholarship_award`

**Files:**
- Create: `db/migrations/V046__missions_scholar_award.sql`
- Create: `db/tests/37_missions_scholar_award.sql`

- [ ] **Step 1: Write `db/tests/37_missions_scholar_award.sql`**

```sql
BEGIN;
SELECT plan(6);

SELECT has_table('missions', 'scholar_program', 'scholar_program exists');
SELECT has_table('missions', 'scholarship_award', 'scholarship_award exists');
SELECT has_fk('missions', 'scholarship_award', 'award has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Scholar', 'X') RETURNING person_id AS s_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Sponsor', 'Y') RETURNING person_id AS sp_pid \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:s_pid, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id AS s_mid \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:sp_pid, :branch_id, 'B-2', 'REGULAR_MEMBER', now()) RETURNING member_id AS sp_mid \gset

INSERT INTO missions.scholar_program (name, status) VALUES ('2026 Scholarship', 'ACTIVE')
  RETURNING program_id \gset

INSERT INTO missions.scholarship_award (program_id, member_id, school_name, amount, sponsor_member_id, status)
  VALUES (:program_id, :s_mid, 'UP Diliman', 25000, :sp_mid, 'ACTIVE');
SELECT pass('award insert with sponsor succeeds');

SELECT throws_ok(
  $$INSERT INTO missions.scholarship_award (program_id, member_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid award_status rejected'
);

SELECT throws_ok(
  $$INSERT INTO missions.scholar_program (name, status) VALUES ('X', 'BOGUS')$$,
  '22P02', NULL, 'invalid program_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V046__missions_scholar_award.sql`**

```sql
CREATE TYPE missions.program_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE missions.award_status AS ENUM ('AWARDED', 'ACTIVE', 'COMPLETED', 'REVOKED');

CREATE TABLE missions.scholar_program (
  program_id   BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  starts_on    DATE,
  ends_on      DATE,
  description  TEXT,
  status       missions.program_status NOT NULL DEFAULT 'PLANNING',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scholar_program_status ON missions.scholar_program(status);

CREATE TRIGGER trg_scholar_program_updated_at
  BEFORE UPDATE ON missions.scholar_program
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.scholar_program IS 'Scholarship program definition.';

CREATE TABLE missions.scholarship_award (
  award_id            BIGSERIAL PRIMARY KEY,
  program_id          BIGINT NOT NULL REFERENCES missions.scholar_program(program_id),
  member_id           BIGINT NOT NULL REFERENCES membership.member(member_id),
  awarded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  term                TEXT,
  amount              NUMERIC,
  school_name         TEXT,
  sponsor_member_id   BIGINT REFERENCES membership.member(member_id),
  status              missions.award_status NOT NULL DEFAULT 'AWARDED',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_award_program ON missions.scholarship_award(program_id);
CREATE INDEX idx_award_member ON missions.scholarship_award(member_id);
CREATE INDEX idx_award_sponsor ON missions.scholarship_award(sponsor_member_id);

CREATE TRIGGER trg_scholarship_award_updated_at
  BEFORE UPDATE ON missions.scholarship_award
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.scholarship_award IS 'Scholarship award to a JLY member. school_name is free text (internal or external). Amount is informational only.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V046__missions_scholar_award.sql \
        db/tests/37_missions_scholar_award.sql
git commit -m "feat(db): add missions.scholar_program and missions.scholarship_award"
```

---

### Task 4: `missions.bac_initiative` + `missions.bac_session`

**Files:**
- Create: `db/migrations/V047__missions_bac_initiative_session.sql`
- Create: `db/tests/38_missions_bac_initiative_session.sql`

- [ ] **Step 1: Write `db/tests/38_missions_bac_initiative_session.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('missions', 'bac_initiative', 'bac_initiative exists');
SELECT has_table('missions', 'bac_session', 'bac_session exists');
SELECT has_fk('missions', 'bac_initiative', 'initiative has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO missions.bac_initiative (branch_id, name, target_community, coordinator_member_id, status)
  VALUES (:branch_id, 'Bless Tondo 2026', 'Tondo, Manila', :member_id, 'ACTIVE')
  RETURNING initiative_id \gset

INSERT INTO missions.bac_session (initiative_id, session_number, topic, facilitator_member_id)
  VALUES (:initiative_id, 1, 'Who is Jesus?', :member_id);
SELECT pass('initiative + session insert succeeds');

SELECT throws_ok(
  $$INSERT INTO missions.bac_initiative (branch_id, name, status) VALUES (1, 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid initiative_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V047__missions_bac_initiative_session.sql`**

```sql
CREATE TYPE missions.initiative_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE missions.bac_initiative (
  initiative_id          BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                   TEXT NOT NULL,
  target_community       TEXT,
  starts_on              DATE,
  ends_on                DATE,
  coordinator_member_id  BIGINT REFERENCES membership.member(member_id),
  status                 missions.initiative_status NOT NULL DEFAULT 'PLANNING',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_initiative_branch ON missions.bac_initiative(branch_id);
CREATE INDEX idx_bac_initiative_status ON missions.bac_initiative(status);

CREATE TRIGGER trg_bac_initiative_updated_at
  BEFORE UPDATE ON missions.bac_initiative
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.bac_initiative IS 'BAC (Bless A Community) outreach campaign.';

CREATE TABLE missions.bac_session (
  session_id             BIGSERIAL PRIMARY KEY,
  initiative_id          BIGINT NOT NULL REFERENCES missions.bac_initiative(initiative_id) ON DELETE CASCADE,
  session_number         INT NOT NULL,
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  duration_minutes       INT,
  venue                  TEXT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_session_initiative ON missions.bac_session(initiative_id);

CREATE TRIGGER trg_bac_session_updated_at
  BEFORE UPDATE ON missions.bac_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.bac_session IS 'Session within a BAC initiative.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V047__missions_bac_initiative_session.sql \
        db/tests/38_missions_bac_initiative_session.sql
git commit -m "feat(db): add missions.bac_initiative and missions.bac_session"
```

---

### Task 5: `missions.bac_participant` + `missions.bac_session_attendance`

**Files:**
- Create: `db/migrations/V048__missions_bac_participant_attendance.sql`
- Create: `db/tests/39_missions_bac_participant_attendance.sql`

- [ ] **Step 1: Write `db/tests/39_missions_bac_participant_attendance.sql`**

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('missions', 'bac_participant', 'participant table exists');
SELECT has_table('missions', 'bac_session_attendance', 'bac attendance table exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Enrolled', 'X') RETURNING person_id AS enrolled_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('WalkIn', 'Y') RETURNING person_id AS walkin_pid \gset

INSERT INTO missions.bac_initiative (branch_id, name, status)
  VALUES (:branch_id, 'Bless Tondo', 'ACTIVE') RETURNING initiative_id \gset

-- Enrolled participant
INSERT INTO missions.bac_participant (initiative_id, person_id, role)
  VALUES (:initiative_id, :enrolled_pid, 'PARTICIPANT');
SELECT pass('participant insert succeeds');

INSERT INTO missions.bac_session (initiative_id, session_number, topic)
  VALUES (:initiative_id, 1, 'Session 1') RETURNING session_id \gset

-- Enrolled person attends
INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :enrolled_pid, true, 'ENROLLED');
SELECT pass('enrolled attendance insert succeeds');

-- Walk-in attends (no bac_participant record needed)
INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :walkin_pid, true, 'WALK_IN');
SELECT pass('walk-in attendance insert succeeds');

-- Duplicate (session, person) should fail
PREPARE dup_bac_att AS
  INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :enrolled_pid, false, 'ENROLLED');
SELECT throws_ok('dup_bac_att', '23505', NULL, 'duplicate (session, person) rejected');

SELECT throws_ok(
  $$INSERT INTO missions.bac_participant (initiative_id, person_id, role)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid bac_role rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V048__missions_bac_participant_attendance.sql`**

```sql
CREATE TYPE missions.bac_role AS ENUM ('LEADER', 'FACILITATOR', 'PARTICIPANT', 'VOLUNTEER');
CREATE TYPE missions.attendance_role AS ENUM ('ENROLLED', 'WALK_IN', 'FACILITATOR');

CREATE TABLE missions.bac_participant (
  participant_id   BIGSERIAL PRIMARY KEY,
  initiative_id    BIGINT NOT NULL REFERENCES missions.bac_initiative(initiative_id) ON DELETE CASCADE,
  person_id        BIGINT NOT NULL REFERENCES core.person(person_id),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at          TIMESTAMPTZ,
  role             missions.bac_role NOT NULL DEFAULT 'PARTICIPANT',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_participant_initiative ON missions.bac_participant(initiative_id);
CREATE INDEX idx_bac_participant_person ON missions.bac_participant(person_id);

COMMENT ON TABLE missions.bac_participant IS 'BAC participant. Uses person_id — open to non-members. Append-only; close by setting left_at.';

CREATE TABLE missions.bac_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES missions.bac_session(session_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  attended       BOOLEAN NOT NULL,
  attended_as    missions.attendance_role NOT NULL DEFAULT 'ENROLLED',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bac_attendance_unique UNIQUE (session_id, person_id)
);

CREATE INDEX idx_bac_attendance_person ON missions.bac_session_attendance(person_id);

COMMENT ON TABLE missions.bac_session_attendance IS 'BAC per-session attendance. Links to person_id directly so walk-ins are trackable without prior enrollment.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V048__missions_bac_participant_attendance.sql \
        db/tests/39_missions_bac_participant_attendance.sql
git commit -m "feat(db): add bac_participant and bac_session_attendance (walk-in support)"
```

---

### Task 6: Role grants

**Files:**
- Create: `db/migrations/V049__plan3a_roles_and_grants.sql`
- Create: `db/tests/40_plan3a_roles.sql`

- [ ] **Step 1: Write `db/tests/40_plan3a_roles.sql`**

```sql
BEGIN;
SELECT plan(4);

-- app_general can read programs and missions (no PII tables)
SET LOCAL ROLE app_general;
PREPARE cohort_read AS SELECT cohort_id FROM programs.heartlink_cohort LIMIT 1;
SELECT lives_ok('cohort_read', 'app_general can read programs.heartlink_cohort');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE program_read AS SELECT program_id FROM missions.scholar_program LIMIT 1;
SELECT lives_ok('program_read', 'app_general can read missions.scholar_program');
RESET ROLE;

-- app_full can write
SET LOCAL ROLE app_full;
PREPARE cohort_write AS
  INSERT INTO programs.heartlink_cohort (branch_id, name) VALUES (1, 'test');
RESET ROLE;

-- app_pastoral can read
SET LOCAL ROLE app_pastoral;
PREPARE award_read AS SELECT award_id FROM missions.scholarship_award LIMIT 1;
SELECT lives_ok('award_read', 'app_pastoral can read missions.scholarship_award');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE bac_read AS SELECT initiative_id FROM missions.bac_initiative LIMIT 1;
SELECT lives_ok('bac_read', 'app_pastoral can read missions.bac_initiative');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V049__plan3a_roles_and_grants.sql`**

```sql
-- app_full: full read/write access
GRANT USAGE ON SCHEMA programs, missions TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA programs, missions TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA programs, missions TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read
GRANT USAGE ON SCHEMA programs, missions TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access (no PII tables to revoke in these schemas)
GRANT USAGE ON SCHEMA programs, missions TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_general;
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V049__plan3a_roles_and_grants.sql \
        db/tests/40_plan3a_roles.sql
git commit -m "feat(db): extend role grants for programs and missions schemas"
```

---

### Task 7: End-to-end smoke test update

**Files:**
- Modify: `db/tests/99_smoke_e2e.sql`

- [ ] **Step 1: Add programs + missions scenarios to smoke test**

Update `plan(13)` to `plan(17)` and append before the final `SELECT * FROM finish();`:

```sql
-- ==================== Plan 3a: Programs + Missions ====================

-- Heartlink: create cohort, enroll Juan, record session attendance
INSERT INTO programs.heartlink_cohort (branch_id, name, facilitator_member_id, status)
  VALUES (:branch_id, 'Manila Heartlink Q1 2026', :jdc_member, 'ACTIVE')
  RETURNING cohort_id AS hl_cohort \gset

INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:hl_cohort, :jdc_id) RETURNING enrollment_id AS hl_enroll \gset

INSERT INTO programs.heartlink_session (cohort_id, session_number, topic)
  VALUES (:hl_cohort, 1, 'Identity in Christ') RETURNING session_id AS hl_session \gset

INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:hl_session, :hl_enroll, true);

SELECT is(
  (SELECT count(*)::int FROM programs.heartlink_session_attendance
   WHERE session_id = :hl_session AND attended = true),
  1,
  'Heartlink session attendance recorded'
);

-- Scholar: award a scholarship to Juan
INSERT INTO missions.scholar_program (name, status) VALUES ('2026 Scholars', 'ACTIVE')
  RETURNING program_id AS scholar_prog \gset

INSERT INTO missions.scholarship_award (program_id, member_id, school_name, amount, status)
  VALUES (:scholar_prog, :jdc_member, 'UP Diliman', 25000, 'ACTIVE');

SELECT is(
  (SELECT school_name FROM missions.scholarship_award WHERE member_id = :jdc_member),
  'UP Diliman',
  'scholarship award with school_name'
);

-- BAC: create initiative, add walk-in attendance
INSERT INTO missions.bac_initiative (branch_id, name, target_community, status)
  VALUES (:branch_id, 'Bless Tondo 2026', 'Tondo, Manila', 'ACTIVE')
  RETURNING initiative_id AS bac_init \gset

INSERT INTO missions.bac_session (initiative_id, session_number, topic)
  VALUES (:bac_init, 1, 'Who is Jesus?') RETURNING session_id AS bac_sess \gset

INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:bac_sess, :ftv_pid, true, 'WALK_IN');

SELECT is(
  (SELECT attended_as::text FROM missions.bac_session_attendance
   WHERE session_id = :bac_sess AND person_id = :ftv_pid),
  'WALK_IN',
  'BAC walk-in attendance recorded'
);

SELECT pass('programs + missions end-to-end complete');
```

- [ ] **Step 2: Run from clean rebuild**

```bash
cd db
docker compose down -v
docker compose up -d postgres
sleep 10
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

- [ ] **Step 3: Commit and tag**

```bash
git add db/tests/99_smoke_e2e.sql
git commit -m "test(db): extend e2e smoke test with Heartlink/Scholar/BAC scenarios"
git tag plan-3a-programs-missions-complete
```

---

## Self-Review Checklist

- [ ] All 7 tasks completed with green tests.
- [ ] `git tag plan-3a-programs-missions-complete` exists.
- [ ] `programs` schema: heartlink_cohort, heartlink_enrollment (UNIQUE cohort+person), heartlink_session, heartlink_session_attendance (UNIQUE session+enrollment).
- [ ] `missions` schema: scholar_program, scholarship_award (member_id not person_id), bac_initiative, bac_session, bac_participant, bac_session_attendance (UNIQUE session+person, walk-in via person_id).
- [ ] All role grants extended (app_full, app_pastoral, app_general) with no PII revocations needed.
- [ ] BAC attendance uses person_id (not enrollment_id) for walk-in support.
- [ ] Heartlink attendance uses enrollment_id (must be enrolled).

---

## What's next

- **Plan 3b (Education):** `education` schema — Bible College (9 tables) + ISU (5 tables) + school lookup.
- **Plan 4 (Migration):** `staging` schema, Python ETL from Google Sheets.
