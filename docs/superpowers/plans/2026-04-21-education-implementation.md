# Plan 3b: Education Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `education` schema covering Bible College (formal academic structure, no grades) and ISU (continuous track-based discipleship), plus a shared school lookup.

**Architecture:** Single `education` schema with three phases: (1) school lookup with 2 seeded rows, (2) Bible College tables prefixed `bc_*` (9 tables), (3) ISU tables prefixed `isu_*` (5 tables). Dependencies: `education` depends on `core` (person, branch) and `membership` (member). No dependencies on `programs`, `missions`, `events`, or `attendance`.

**Tech Stack:** PostgreSQL 16, Flyway Community (V* versioned + R__ repeatable), pgTAP tests, Docker Compose, Git Bash on Windows.

---

## File Map

### Migrations (V050-V059 + 1 repeatable)

| File | Purpose |
|---|---|
| `db/migrations/V050__create_education_schema.sql` | Schema, all 6 enums, school table |
| `db/migrations/R__seed_schools.sql` | Seed BIBLE_COLLEGE, ISU |
| `db/migrations/V051__education_bc_program_cohort.sql` | bc_program, bc_cohort |
| `db/migrations/V052__education_bc_semester_course.sql` | bc_semester, bc_course |
| `db/migrations/V053__education_bc_course_offering.sql` | bc_course_offering |
| `db/migrations/V054__education_bc_student.sql` | bc_student |
| `db/migrations/V055__education_bc_enrollment_completion.sql` | bc_enrollment, bc_completion |
| `db/migrations/V056__education_bc_class_attendance.sql` | bc_class_attendance |
| `db/migrations/V057__education_isu_track_student.sql` | isu_track, isu_student |
| `db/migrations/V058__education_isu_progression_session.sql` | isu_track_progression, isu_session, isu_session_attendance |
| `db/migrations/V059__plan3b_roles_and_grants.sql` | Role grants for education schema |

### Tests (41-50 + smoke update)

| File | Purpose |
|---|---|
| `db/tests/41_education_school.sql` | Schema exists, school table, seed data, enum validation |
| `db/tests/42_bc_program_cohort.sql` | bc_program + bc_cohort: inserts, unique, FK |
| `db/tests/43_bc_semester_course.sql` | bc_semester + bc_course: inserts, defaults, enum, unique |
| `db/tests/44_bc_course_offering.sql` | bc_course_offering: JSONB, unique composite, FK |
| `db/tests/45_bc_student.sql` | bc_student: unique person_id, unique student_number, enum |
| `db/tests/46_bc_enrollment_completion.sql` | bc_enrollment + bc_completion: 1:1 PK, attendance_rate |
| `db/tests/47_bc_class_attendance.sql` | bc_class_attendance: triple unique constraint |
| `db/tests/48_isu_track_student.sql` | isu_track + isu_student: inserts, unique, defaults |
| `db/tests/49_isu_progression_session.sql` | isu_track_progression, isu_session, isu_session_attendance |
| `db/tests/50_plan3b_roles.sql` | Role grants: app_general, app_pastoral reads |
| `db/tests/99_smoke_e2e.sql` | Add education assertions (plan count 17 → 21) |

---

### Task 1: Education Schema + School Lookup

**Files:**
- Create: `db/migrations/V050__create_education_schema.sql`
- Create: `db/migrations/R__seed_schools.sql`
- Create: `db/tests/41_education_school.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/41_education_school.sql`:

```sql
BEGIN;
SELECT plan(6);

SELECT has_schema('education', 'education schema exists');
SELECT has_table('education', 'school', 'school table exists');

-- Seed data
SELECT is(
  (SELECT count(*)::int FROM education.school),
  2,
  'two schools seeded'
);

SELECT is(
  (SELECT name FROM education.school WHERE code = 'BIBLE_COLLEGE'),
  'Bible College',
  'BIBLE_COLLEGE seeded correctly'
);

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO education.school (code, name, status) VALUES ('X', 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid school_status rejected'
);

-- Unique code
PREPARE dup_school AS INSERT INTO education.school (code, name) VALUES ('BIBLE_COLLEGE', 'Dup');
SELECT throws_ok('dup_school', '23505', NULL, 'duplicate school code rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/41_education_school.sql
```

Expected: FAIL — schema `education` does not exist.

- [ ] **Step 3: Write the schema migration**

Create `db/migrations/V050__create_education_schema.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS education;
COMMENT ON SCHEMA education IS 'Bible College and ISU (International Success University) education tracking.';

CREATE TYPE education.school_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE education.semester_status AS ENUM ('PLANNED', 'REGISTRATION', 'ACTIVE', 'GRADING', 'CLOSED');
CREATE TYPE education.bc_student_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'GRADUATED', 'WITHDRAWN', 'DISMISSED');
CREATE TYPE education.bc_enrollment_status AS ENUM ('ENROLLED', 'DROPPED', 'COMPLETED', 'WITHDRAWN');
CREATE TYPE education.bc_completion_status AS ENUM ('COMPLETED', 'INCOMPLETE', 'WITHDRAWN');
CREATE TYPE education.isu_student_status AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED');

CREATE TABLE education.school (
  school_id    BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  founded_on   DATE,
  status       education.school_status NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_school_updated_at
  BEFORE UPDATE ON education.school
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.school IS 'School lookup. Seeded: BIBLE_COLLEGE, ISU.';
```

- [ ] **Step 4: Write the seed migration**

Create `db/migrations/R__seed_schools.sql`:

```sql
INSERT INTO education.school (code, name, description) VALUES
  ('BIBLE_COLLEGE', 'Bible College', 'JLY Bible College — formal academic structure.'),
  ('ISU', 'International Success University', 'ISU — continuous track-based discipleship.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
```

- [ ] **Step 5: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V050 + R__seed_schools applied successfully.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/41_education_school.sql
```

Expected: All 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V050__create_education_schema.sql db/migrations/R__seed_schools.sql db/tests/41_education_school.sql
git commit -m "feat(education): add schema, enums, school lookup with seed data"
```

---

### Task 2: Bible College Program + Cohort

**Files:**
- Create: `db/migrations/V051__education_bc_program_cohort.sql`
- Create: `db/tests/42_bc_program_cohort.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/42_bc_program_cohort.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_program', 'bc_program table exists');
SELECT has_table('education', 'bc_cohort', 'bc_cohort table exists');
SELECT has_fk('education', 'bc_cohort', 'bc_cohort has FK');

INSERT INTO education.bc_program (code, name, degree_level, total_credits, duration_years)
  VALUES ('BT', 'Bachelor of Theology', 'Bachelor', 120, 4)
  RETURNING program_id \gset
SELECT pass('bc_program insert succeeds');

INSERT INTO education.bc_cohort (program_id, name, starts_on, expected_graduation_on)
  VALUES (:program_id, 'BT Class of 2028', '2024-06-01', '2028-03-31')
  RETURNING cohort_id \gset
SELECT pass('bc_cohort insert succeeds');

-- Unique program code
PREPARE dup_prog AS INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Duplicate');
SELECT throws_ok('dup_prog', '23505', NULL, 'duplicate program code rejected');

-- FK violation
PREPARE bad_cohort_fk AS INSERT INTO education.bc_cohort (program_id, name) VALUES (999999, 'Bad');
SELECT throws_ok('bad_cohort_fk', '23503', NULL, 'invalid program_id FK rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/42_bc_program_cohort.sql
```

Expected: FAIL — table `education.bc_program` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V051__education_bc_program_cohort.sql`:

```sql
CREATE TABLE education.bc_program (
  program_id     BIGSERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  degree_level   TEXT,
  total_credits  INT,
  duration_years INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_bc_program_updated_at
  BEFORE UPDATE ON education.bc_program
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_program IS 'Bible College academic program (e.g., "Bachelor of Theology").';

CREATE TABLE education.bc_cohort (
  cohort_id              BIGSERIAL PRIMARY KEY,
  program_id             BIGINT NOT NULL REFERENCES education.bc_program(program_id),
  name                   TEXT NOT NULL,
  starts_on              DATE,
  expected_graduation_on DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_cohort_program ON education.bc_cohort(program_id);

CREATE TRIGGER trg_bc_cohort_updated_at
  BEFORE UPDATE ON education.bc_cohort
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_cohort IS 'Bible College cohort (e.g., "BT Class of 2028").';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V051 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/42_bc_program_cohort.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V051__education_bc_program_cohort.sql db/tests/42_bc_program_cohort.sql
git commit -m "feat(education): add bc_program and bc_cohort tables"
```

---

### Task 3: Bible College Semester + Course

**Files:**
- Create: `db/migrations/V052__education_bc_semester_course.sql`
- Create: `db/tests/43_bc_semester_course.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/43_bc_semester_course.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_semester', 'bc_semester table exists');
SELECT has_table('education', 'bc_course', 'bc_course table exists');

INSERT INTO education.bc_semester (name, academic_year, term_number, starts_on, ends_on)
  VALUES ('1st Sem AY 2024-2025', '2024-2025', 1, '2024-06-01', '2024-10-31')
  RETURNING semester_id \gset
SELECT pass('bc_semester insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.bc_semester WHERE semester_id = :semester_id),
  'PLANNED',
  'semester defaults to PLANNED'
);

INSERT INTO education.bc_course (code, title, credits, department)
  VALUES ('THE101', 'Introduction to Theology', 3, 'Theology')
  RETURNING course_id \gset
SELECT pass('bc_course insert succeeds');

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO education.bc_semester (name, status) VALUES ('X', 'BOGUS')$$,
  '22P02', NULL, 'invalid semester_status rejected'
);

-- Unique course code
PREPARE dup_course AS INSERT INTO education.bc_course (code, title) VALUES ('THE101', 'Dup');
SELECT throws_ok('dup_course', '23505', NULL, 'duplicate course code rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/43_bc_semester_course.sql
```

Expected: FAIL — table `education.bc_semester` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V052__education_bc_semester_course.sql`:

```sql
CREATE TABLE education.bc_semester (
  semester_id   BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  academic_year TEXT,
  term_number   INT,
  starts_on     DATE,
  ends_on       DATE,
  status        education.semester_status NOT NULL DEFAULT 'PLANNED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_semester_status ON education.bc_semester(status);

CREATE TRIGGER trg_bc_semester_updated_at
  BEFORE UPDATE ON education.bc_semester
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_semester IS 'Academic semester. Shared across all programs.';

CREATE TABLE education.bc_course (
  course_id    BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  credits      INT,
  description  TEXT,
  department   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_bc_course_updated_at
  BEFORE UPDATE ON education.bc_course
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_course IS 'Bible College course catalog entry (e.g., "THE101 Introduction to Theology").';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V052 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/43_bc_semester_course.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V052__education_bc_semester_course.sql db/tests/43_bc_semester_course.sql
git commit -m "feat(education): add bc_semester and bc_course tables"
```

---

### Task 4: Bible College Course Offering

**Files:**
- Create: `db/migrations/V053__education_bc_course_offering.sql`
- Create: `db/tests/44_bc_course_offering.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/44_bc_course_offering.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_course_offering', 'bc_course_offering table exists');
SELECT has_fk('education', 'bc_course_offering', 'bc_course_offering has FK');

-- Setup
INSERT INTO education.bc_semester (name, academic_year, term_number)
  VALUES ('1st Sem 2024-2025', '2024-2025', 1)
  RETURNING semester_id \gset
INSERT INTO education.bc_course (code, title, credits)
  VALUES ('THE101', 'Intro to Theology', 3)
  RETURNING course_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('I', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO education.bc_course_offering
  (course_id, semester_id, instructor_member_id, max_seats, schedule, venue)
  VALUES (:course_id, :semester_id, :member_id, 40,
          '{"day":"Monday","time":"09:00","room":"A101"}'::jsonb, 'Room A101')
  RETURNING offering_id \gset
SELECT pass('bc_course_offering insert succeeds');

-- JSONB queryable
SELECT is(
  (SELECT schedule->>'day' FROM education.bc_course_offering WHERE offering_id = :offering_id),
  'Monday',
  'schedule JSONB queryable by key'
);

-- Unique (course_id, semester_id)
PREPARE dup_offering AS
  INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:course_id, :semester_id);
SELECT throws_ok('dup_offering', '23505', NULL, 'duplicate (course, semester) rejected');

-- FK violation
PREPARE bad_offering_fk AS
  INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (999999, :semester_id);
SELECT throws_ok('bad_offering_fk', '23503', NULL, 'invalid course_id FK rejected');

-- Default schedule
INSERT INTO education.bc_course (code, title) VALUES ('THE102', 'Theology 2') RETURNING course_id AS c2 \gset
INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:c2, :semester_id) RETURNING offering_id AS o2 \gset
SELECT is(
  (SELECT schedule FROM education.bc_course_offering WHERE offering_id = :o2),
  '{}'::jsonb,
  'schedule defaults to empty JSONB object'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/44_bc_course_offering.sql
```

Expected: FAIL — table `education.bc_course_offering` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V053__education_bc_course_offering.sql`:

```sql
CREATE TABLE education.bc_course_offering (
  offering_id            BIGSERIAL PRIMARY KEY,
  course_id              BIGINT NOT NULL REFERENCES education.bc_course(course_id),
  semester_id            BIGINT NOT NULL REFERENCES education.bc_semester(semester_id),
  instructor_member_id   BIGINT REFERENCES membership.member(member_id),
  max_seats              INT,
  schedule               JSONB NOT NULL DEFAULT '{}',
  venue                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_offering_course_semester_unique UNIQUE (course_id, semester_id)
);

CREATE INDEX idx_bc_offering_semester ON education.bc_course_offering(semester_id);

CREATE TRIGGER trg_bc_offering_updated_at
  BEFORE UPDATE ON education.bc_course_offering
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_course_offering IS 'Course offered in a specific semester. schedule JSONB is app-interpreted.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V053 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/44_bc_course_offering.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V053__education_bc_course_offering.sql db/tests/44_bc_course_offering.sql
git commit -m "feat(education): add bc_course_offering table"
```

---

### Task 5: Bible College Student

**Files:**
- Create: `db/migrations/V054__education_bc_student.sql`
- Create: `db/tests/45_bc_student.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/45_bc_student.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_student', 'bc_student table exists');
SELECT has_fk('education', 'bc_student', 'bc_student has FK');

-- Setup
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Bachelor of Theology')
  RETURNING program_id \gset
INSERT INTO education.bc_cohort (program_id, name) VALUES (:program_id, 'BT 2028')
  RETURNING cohort_id \gset
INSERT INTO core.person (first_name, last_name, gender) VALUES ('Juan', 'Student', 'MALE')
  RETURNING person_id \gset

INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-2024-0001', '2024-06-01')
  RETURNING student_id \gset
SELECT pass('bc_student insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.bc_student WHERE student_id = :student_id),
  'ACTIVE',
  'bc_student defaults to ACTIVE'
);

-- Unique person_id
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'Y') RETURNING person_id AS p2 \gset
PREPARE dup_person AS
  INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-2024-0099', '2024-06-01');
SELECT throws_ok('dup_person', '23505', NULL, 'duplicate person_id rejected');

-- Unique student_number (needs fresh person to avoid person_id conflict)
PREPARE dup_snum AS
  INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:p2, :cohort_id, 'BC-2024-0001', '2024-06-01');
SELECT throws_ok('dup_snum', '23505', NULL, 'duplicate student_number rejected');

-- Invalid enum
SELECT throws_ok(
  $$INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on, status)
    VALUES (1, 1, 'XX', '2024-01-01', 'BOGUS')$$,
  '22P02', NULL, 'invalid bc_student_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/45_bc_student.sql
```

Expected: FAIL — table `education.bc_student` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V054__education_bc_student.sql`:

```sql
CREATE TABLE education.bc_student (
  student_id     BIGSERIAL PRIMARY KEY,
  person_id      BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  cohort_id      BIGINT NOT NULL REFERENCES education.bc_cohort(cohort_id),
  student_number TEXT NOT NULL UNIQUE,
  enrolled_on    DATE NOT NULL,
  status         education.bc_student_status NOT NULL DEFAULT 'ACTIVE',
  graduated_on   DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_student_cohort ON education.bc_student(cohort_id);
CREATE INDEX idx_bc_student_status ON education.bc_student(status);

CREATE TRIGGER trg_bc_student_updated_at
  BEFORE UPDATE ON education.bc_student
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_student IS 'Bible College student. person_id UNIQUE (one student record per person). No branch_id — derived from person/member record.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V054 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/45_bc_student.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V054__education_bc_student.sql db/tests/45_bc_student.sql
git commit -m "feat(education): add bc_student table"
```

---

### Task 6: Bible College Enrollment + Completion

**Files:**
- Create: `db/migrations/V055__education_bc_enrollment_completion.sql`
- Create: `db/tests/46_bc_enrollment_completion.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/46_bc_enrollment_completion.sql`:

```sql
BEGIN;
SELECT plan(9);

SELECT has_table('education', 'bc_enrollment', 'bc_enrollment table exists');
SELECT has_table('education', 'bc_completion', 'bc_completion table exists');
SELECT has_fk('education', 'bc_enrollment', 'bc_enrollment has FK');

-- Setup: program -> cohort -> student, semester -> course -> offering
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Bachelor of Theology')
  RETURNING program_id \gset
INSERT INTO education.bc_cohort (program_id, name) VALUES (:program_id, 'BT 2028')
  RETURNING cohort_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-0001', '2024-06-01')
  RETURNING student_id \gset
INSERT INTO education.bc_semester (name) VALUES ('1st Sem')
  RETURNING semester_id \gset
INSERT INTO education.bc_course (code, title) VALUES ('THE101', 'Intro')
  RETURNING course_id \gset
INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:course_id, :semester_id)
  RETURNING offering_id \gset

-- Enrollment
INSERT INTO education.bc_enrollment (student_id, offering_id, enrolled_on)
  VALUES (:student_id, :offering_id, '2024-06-15')
  RETURNING enrollment_id \gset
SELECT pass('bc_enrollment insert succeeds');

-- Default enrollment status
SELECT is(
  (SELECT status::text FROM education.bc_enrollment WHERE enrollment_id = :enrollment_id),
  'ENROLLED',
  'enrollment defaults to ENROLLED'
);

-- Unique (student, offering)
PREPARE dup_enroll AS
  INSERT INTO education.bc_enrollment (student_id, offering_id, enrolled_on)
  VALUES (:student_id, :offering_id, '2024-06-15');
SELECT throws_ok('dup_enroll', '23505', NULL, 'duplicate (student, offering) rejected');

-- Completion 1:1
INSERT INTO education.bc_completion (enrollment_id, status, completed_on, attendance_rate)
  VALUES (:enrollment_id, 'COMPLETED', '2024-10-31', 0.92);
SELECT pass('bc_completion insert succeeds');

SELECT is(
  (SELECT attendance_rate FROM education.bc_completion WHERE enrollment_id = :enrollment_id),
  0.92::numeric,
  'attendance_rate stored correctly'
);

-- Duplicate completion (1:1 PK)
PREPARE dup_comp AS
  INSERT INTO education.bc_completion (enrollment_id, status)
  VALUES (:enrollment_id, 'COMPLETED');
SELECT throws_ok('dup_comp', '23505', NULL, 'duplicate completion (1:1 PK) rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/46_bc_enrollment_completion.sql
```

Expected: FAIL — table `education.bc_enrollment` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V055__education_bc_enrollment_completion.sql`:

```sql
CREATE TABLE education.bc_enrollment (
  enrollment_id  BIGSERIAL PRIMARY KEY,
  student_id     BIGINT NOT NULL REFERENCES education.bc_student(student_id) ON DELETE CASCADE,
  offering_id    BIGINT NOT NULL REFERENCES education.bc_course_offering(offering_id) ON DELETE CASCADE,
  enrolled_on    DATE NOT NULL,
  status         education.bc_enrollment_status NOT NULL DEFAULT 'ENROLLED',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_enrollment_student_offering_unique UNIQUE (student_id, offering_id)
);

CREATE INDEX idx_bc_enrollment_offering ON education.bc_enrollment(offering_id);

CREATE TRIGGER trg_bc_enrollment_updated_at
  BEFORE UPDATE ON education.bc_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_enrollment IS 'Student enrollment in a course offering.';

CREATE TABLE education.bc_completion (
  enrollment_id    BIGINT PRIMARY KEY REFERENCES education.bc_enrollment(enrollment_id),
  status           education.bc_completion_status NOT NULL,
  completed_on     DATE,
  attendance_rate  NUMERIC,
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE education.bc_completion IS 'Completion record for a course enrollment. 1:1 with bc_enrollment. No letter grades, no GPA — attendance rate only.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V055 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/46_bc_enrollment_completion.sql
```

Expected: All 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V055__education_bc_enrollment_completion.sql db/tests/46_bc_enrollment_completion.sql
git commit -m "feat(education): add bc_enrollment and bc_completion tables"
```

---

### Task 7: Bible College Class Attendance

**Files:**
- Create: `db/migrations/V056__education_bc_class_attendance.sql`
- Create: `db/tests/47_bc_class_attendance.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/47_bc_class_attendance.sql`:

```sql
BEGIN;
SELECT plan(6);

SELECT has_table('education', 'bc_class_attendance', 'bc_class_attendance table exists');
SELECT has_fk('education', 'bc_class_attendance', 'bc_class_attendance has FK');

-- Setup
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'BT')
  RETURNING program_id \gset
INSERT INTO education.bc_cohort (program_id, name) VALUES (:program_id, 'BT 2028')
  RETURNING cohort_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-0001', '2024-06-01')
  RETURNING student_id \gset
INSERT INTO education.bc_semester (name) VALUES ('1st Sem')
  RETURNING semester_id \gset
INSERT INTO education.bc_course (code, title) VALUES ('THE101', 'Intro')
  RETURNING course_id \gset
INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:course_id, :semester_id)
  RETURNING offering_id \gset

INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-01', true);
SELECT pass('bc_class_attendance insert succeeds');

INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-08', false);
SELECT pass('second class_date insert succeeds');

-- Unique (offering, student, class_date)
PREPARE dup_att AS
  INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-01', false);
SELECT throws_ok('dup_att', '23505', NULL, 'duplicate (offering, student, class_date) rejected');

-- Count
SELECT is(
  (SELECT count(*)::int FROM education.bc_class_attendance WHERE offering_id = :offering_id),
  2,
  'two attendance records for offering'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/47_bc_class_attendance.sql
```

Expected: FAIL — table `education.bc_class_attendance` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V056__education_bc_class_attendance.sql`:

```sql
CREATE TABLE education.bc_class_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  offering_id    BIGINT NOT NULL REFERENCES education.bc_course_offering(offering_id) ON DELETE CASCADE,
  student_id     BIGINT NOT NULL REFERENCES education.bc_student(student_id) ON DELETE CASCADE,
  class_date     DATE NOT NULL,
  attended       BOOLEAN NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_class_attendance_unique UNIQUE (offering_id, student_id, class_date)
);

CREATE INDEX idx_bc_class_att_offering ON education.bc_class_attendance(offering_id);
CREATE INDEX idx_bc_class_att_student ON education.bc_class_attendance(student_id);

COMMENT ON TABLE education.bc_class_attendance IS 'Per-class Bible College attendance. Dedicated tracking (not via events schema).';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V056 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/47_bc_class_attendance.sql
```

Expected: All 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V056__education_bc_class_attendance.sql db/tests/47_bc_class_attendance.sql
git commit -m "feat(education): add bc_class_attendance table"
```

---

### Task 8: ISU Track + Student

**Files:**
- Create: `db/migrations/V057__education_isu_track_student.sql`
- Create: `db/tests/48_isu_track_student.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/48_isu_track_student.sql`:

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('education', 'isu_track', 'isu_track table exists');
SELECT has_table('education', 'isu_student', 'isu_student table exists');
SELECT has_fk('education', 'isu_student', 'isu_student has FK');

INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('FOUNDATIONS', 'Foundations', 1)
  RETURNING track_id \gset
SELECT pass('isu_track insert succeeds');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.isu_student (person_id, current_track_id, enrolled_on)
  VALUES (:person_id, :track_id, '2024-06-01')
  RETURNING student_id \gset
SELECT pass('isu_student insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.isu_student WHERE student_id = :student_id),
  'ACTIVE',
  'isu_student defaults to ACTIVE'
);

-- Unique person_id
PREPARE dup_isu_person AS
  INSERT INTO education.isu_student (person_id, enrolled_on) VALUES (:person_id, '2024-06-01');
SELECT throws_ok('dup_isu_person', '23505', NULL, 'duplicate person_id rejected');

-- Unique track code
PREPARE dup_track AS
  INSERT INTO education.isu_track (code, name, order_index) VALUES ('FOUNDATIONS', 'Dup', 2);
SELECT throws_ok('dup_track', '23505', NULL, 'duplicate track code rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/48_isu_track_student.sql
```

Expected: FAIL — table `education.isu_track` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V057__education_isu_track_student.sql`:

```sql
CREATE TABLE education.isu_track (
  track_id     BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  order_index  INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_isu_track_updated_at
  BEFORE UPDATE ON education.isu_track
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_track IS 'ISU learning track. Ordered by order_index for progression.';

CREATE TABLE education.isu_student (
  student_id       BIGSERIAL PRIMARY KEY,
  person_id        BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  current_track_id BIGINT REFERENCES education.isu_track(track_id),
  enrolled_on      DATE NOT NULL,
  status           education.isu_student_status NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_student_track ON education.isu_student(current_track_id);
CREATE INDEX idx_isu_student_status ON education.isu_student(status);

CREATE TRIGGER trg_isu_student_updated_at
  BEFORE UPDATE ON education.isu_student
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_student IS 'ISU student. Continuous enrollment, no cohorts/semesters. person_id UNIQUE.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V057 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/48_isu_track_student.sql
```

Expected: All 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V057__education_isu_track_student.sql db/tests/48_isu_track_student.sql
git commit -m "feat(education): add isu_track and isu_student tables"
```

---

### Task 9: ISU Progression + Session + Session Attendance

**Files:**
- Create: `db/migrations/V058__education_isu_progression_session.sql`
- Create: `db/tests/49_isu_progression_session.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/49_isu_progression_session.sql`:

```sql
BEGIN;
SELECT plan(9);

SELECT has_table('education', 'isu_track_progression', 'isu_track_progression table exists');
SELECT has_table('education', 'isu_session', 'isu_session table exists');
SELECT has_table('education', 'isu_session_attendance', 'isu_session_attendance table exists');

-- Setup
INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('FOUND', 'Foundations', 1) RETURNING track_id AS t1 \gset
INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('GROW', 'Growth', 2) RETURNING track_id AS t2 \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.isu_student (person_id, current_track_id, enrolled_on)
  VALUES (:person_id, :t1, '2024-06-01')
  RETURNING student_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset

-- Track progression: initial enrollment (from NULL)
INSERT INTO education.isu_track_progression (student_id, from_track_id, to_track_id, notes)
  VALUES (:student_id, NULL, :t1, 'Initial enrollment');
SELECT pass('initial track progression succeeds');

-- Progress to next track
INSERT INTO education.isu_track_progression (student_id, from_track_id, to_track_id)
  VALUES (:student_id, :t1, :t2);
SELECT is(
  (SELECT count(*)::int FROM education.isu_track_progression WHERE student_id = :student_id),
  2,
  'two progression records for student'
);

-- Session
INSERT INTO education.isu_session (branch_id, track_id, topic, scheduled_at)
  VALUES (:branch_id, :t1, 'Who is Jesus?', '2024-07-01 09:00:00+08')
  RETURNING session_id \gset
SELECT pass('isu_session insert succeeds');

-- Session attendance (uses person_id, not student_id)
INSERT INTO education.isu_session_attendance (session_id, person_id, attended)
  VALUES (:session_id, :person_id, true);
SELECT pass('isu_session_attendance insert succeeds');

-- Unique (session, person)
PREPARE dup_isu_att AS
  INSERT INTO education.isu_session_attendance (session_id, person_id, attended)
  VALUES (:session_id, :person_id, false);
SELECT throws_ok('dup_isu_att', '23505', NULL, 'duplicate (session, person) rejected');

-- FK on session
PREPARE bad_sess_fk AS
  INSERT INTO education.isu_session (branch_id, track_id)
  VALUES (:branch_id, 999999);
SELECT throws_ok('bad_sess_fk', '23503', NULL, 'invalid track_id FK rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/49_isu_progression_session.sql
```

Expected: FAIL — table `education.isu_track_progression` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V058__education_isu_progression_session.sql`:

```sql
CREATE TABLE education.isu_track_progression (
  progression_id  BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES education.isu_student(student_id) ON DELETE CASCADE,
  from_track_id   BIGINT REFERENCES education.isu_track(track_id),
  to_track_id     BIGINT NOT NULL REFERENCES education.isu_track(track_id),
  progressed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_progression_student ON education.isu_track_progression(student_id);

COMMENT ON TABLE education.isu_track_progression IS 'ISU track progression history. from_track_id is NULL for initial enrollment.';

CREATE TABLE education.isu_session (
  session_id             BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  track_id               BIGINT NOT NULL REFERENCES education.isu_track(track_id),
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_session_branch ON education.isu_session(branch_id);
CREATE INDEX idx_isu_session_track ON education.isu_session(track_id);

CREATE TRIGGER trg_isu_session_updated_at
  BEFORE UPDATE ON education.isu_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_session IS 'ISU teaching session. Per-branch, per-track.';

CREATE TABLE education.isu_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES education.isu_session(session_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  attended       BOOLEAN NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT isu_session_attendance_unique UNIQUE (session_id, person_id)
);

CREATE INDEX idx_isu_attendance_person ON education.isu_session_attendance(person_id);

COMMENT ON TABLE education.isu_session_attendance IS 'ISU per-session attendance. Uses person_id (not student_id) — anyone can attend.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V058 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/49_isu_progression_session.sql
```

Expected: All 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V058__education_isu_progression_session.sql db/tests/49_isu_progression_session.sql
git commit -m "feat(education): add isu_track_progression, isu_session, isu_session_attendance tables"
```

---

### Task 10: Role Grants

**Files:**
- Create: `db/migrations/V059__plan3b_roles_and_grants.sql`
- Create: `db/tests/50_plan3b_roles.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/50_plan3b_roles.sql`:

```sql
BEGIN;
SELECT plan(4);

SET LOCAL ROLE app_general;
PREPARE school_read AS SELECT school_id FROM education.school LIMIT 1;
SELECT lives_ok('school_read', 'app_general can read education.school');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE bc_student_read AS SELECT student_id FROM education.bc_student LIMIT 1;
SELECT lives_ok('bc_student_read', 'app_general can read education.bc_student');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE isu_student_read AS SELECT student_id FROM education.isu_student LIMIT 1;
SELECT lives_ok('isu_student_read', 'app_pastoral can read education.isu_student');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE bc_enrollment_read AS SELECT enrollment_id FROM education.bc_enrollment LIMIT 1;
SELECT lives_ok('bc_enrollment_read', 'app_pastoral can read education.bc_enrollment');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/50_plan3b_roles.sql
```

Expected: FAIL — `42501` permission denied for schema education.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V059__plan3b_roles_and_grants.sql`:

```sql
-- app_full: full read/write access
GRANT USAGE ON SCHEMA education TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA education TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA education TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read
GRANT USAGE ON SCHEMA education TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access (no PII tables to revoke in education schema)
GRANT USAGE ON SCHEMA education TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_general;
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd db && docker compose run --rm flyway migrate
```

Expected: V059 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/50_plan3b_roles.sql
```

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V059__plan3b_roles_and_grants.sql db/tests/50_plan3b_roles.sql
git commit -m "feat(education): add role grants for education schema"
```

---

### Task 11: E2E Smoke Test Update

**Files:**
- Modify: `db/tests/99_smoke_e2e.sql`

- [ ] **Step 1: Update smoke test**

In `db/tests/99_smoke_e2e.sql`, change the plan count from 17 to 21, and append the following block **before** the final `SELECT * FROM finish();` line (after the line `SELECT pass('programs + missions end-to-end complete');`):

```sql
-- ==================== Plan 3b: Education ====================

-- Bible College: program -> cohort -> semester -> course -> offering
INSERT INTO education.bc_program (code, name, degree_level)
  VALUES ('BT', 'Bachelor of Theology', 'Bachelor')
  RETURNING program_id AS bt_prog \gset

INSERT INTO education.bc_cohort (program_id, name, starts_on)
  VALUES (:bt_prog, 'BT Class of 2028', '2024-06-01')
  RETURNING cohort_id AS bt_cohort \gset

INSERT INTO education.bc_semester (name, academic_year, term_number, status)
  VALUES ('1st Sem AY 2024-2025', '2024-2025', 1, 'ACTIVE')
  RETURNING semester_id AS bt_sem \gset

INSERT INTO education.bc_course (code, title, credits)
  VALUES ('THE101', 'Introduction to Theology', 3)
  RETURNING course_id AS bt_course \gset

INSERT INTO education.bc_course_offering (course_id, semester_id, instructor_member_id, max_seats)
  VALUES (:bt_course, :bt_sem, :jdc_member, 40)
  RETURNING offering_id AS bt_offering \gset

-- Enroll Juan as BC student, enroll in offering, track attendance, complete
INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:jdc_id, :bt_cohort, 'BC-2024-0001', '2024-06-01')
  RETURNING student_id AS jdc_bc_student \gset

INSERT INTO education.bc_enrollment (student_id, offering_id, enrolled_on)
  VALUES (:jdc_bc_student, :bt_offering, '2024-06-15')
  RETURNING enrollment_id AS jdc_bc_enrollment \gset

INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:bt_offering, :jdc_bc_student, '2024-07-01', true);

INSERT INTO education.bc_completion (enrollment_id, status, completed_on, attendance_rate)
  VALUES (:jdc_bc_enrollment, 'COMPLETED', '2024-10-31', 0.95);

SELECT is(
  (SELECT attendance_rate FROM education.bc_completion WHERE enrollment_id = :jdc_bc_enrollment),
  0.95::numeric,
  'Bible College completion with attendance_rate'
);

-- ISU: track -> student -> session -> attendance
INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('FOUND', 'Foundations', 1)
  RETURNING track_id AS isu_found \gset

INSERT INTO education.isu_student (person_id, current_track_id, enrolled_on)
  VALUES (:ftv_pid, :isu_found, CURRENT_DATE)
  RETURNING student_id AS ftv_isu_student \gset

INSERT INTO education.isu_session (branch_id, track_id, topic, scheduled_at)
  VALUES (:branch_id, :isu_found, 'Who is Jesus?', '2024-07-01 09:00:00+08')
  RETURNING session_id AS isu_sess \gset

INSERT INTO education.isu_session_attendance (session_id, person_id, attended)
  VALUES (:isu_sess, :ftv_pid, true);

SELECT is(
  (SELECT count(*)::int FROM education.isu_session_attendance
   WHERE session_id = :isu_sess AND attended = true),
  1,
  'ISU session attendance recorded'
);

-- School lookup
SELECT is(
  (SELECT count(*)::int FROM education.school WHERE status = 'ACTIVE'),
  2,
  'two active schools seeded'
);

SELECT pass('education end-to-end complete');
```

- [ ] **Step 2: Run the full smoke test**

```bash
cd db && VERBOSE=1 docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/99_smoke_e2e.sql
```

Expected: All 21 tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
cd db/tests && bash run_tests.sh
```

Expected: All test files pass (41 through 50 + 99_smoke_e2e).

- [ ] **Step 4: Commit**

```bash
git add db/tests/99_smoke_e2e.sql
git commit -m "test(education): update E2E smoke test with education assertions"
```

- [ ] **Step 5: Tag the milestone**

```bash
git tag plan-3b-education-complete
```
