# Plan 4: Migration & Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `staging` schema for one-shot Google Sheets migration: batch tracking, stg_person pattern table, person dedup tables, standalone pipeline scripts, and a minimal Python loader stub.

**Architecture:** Flyway-managed staging schema (V060-V063) for infrastructure tables. Standalone SQL scripts in `db/staging/` for the cleanse/validate/promote pipeline. Python loader stub in `etl/`. Docker volume mount added for staging scripts so pgTAP tests can `\i` include them.

**Tech Stack:** PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows, Python 3.11+ (psycopg2-binary, pandas, gspread).

---

## File Map

### Migrations (V060-V063)

| File | Purpose |
|---|---|
| `db/migrations/V060__create_staging_schema.sql` | Schema, batch_status + row_status enums, import_batch table |
| `db/migrations/V061__staging_stg_person.sql` | stg_person pattern table |
| `db/migrations/V062__staging_dedup_tables.sql` | merge_review_status enum, dedup_run, person_candidate, person_merge_review |
| `db/migrations/V063__plan4_roles_and_grants.sql` | Role grants for staging schema |

### Tests (51-57)

| File | Purpose |
|---|---|
| `db/tests/51_staging_import_batch.sql` | Schema, enums, import_batch inserts and status tracking |
| `db/tests/52_staging_stg_person.sql` | stg_person inserts, FK to batch, row_status transitions |
| `db/tests/53_staging_dedup_tables.sql` | dedup_run, person_candidate, person_merge_review |
| `db/tests/54_plan4_roles.sql` | Role grants for staging schema |
| `db/tests/55_cleanse_person.sql` | Integration test: runs cleanse script, verifies normalization |
| `db/tests/56_validate_person.sql` | Integration test: runs validate script, verifies error detection |
| `db/tests/57_promote_person.sql` | Integration test: runs promote script, verifies data in operational tables |

### Pipeline Scripts (standalone, not Flyway)

| File | Purpose |
|---|---|
| `db/staging/cleanse_person.sql` | Normalize raw_ columns, set row_status='CLEANSED' |
| `db/staging/validate_person.sql` | Check rules, fill validation_errors, set VALID/INVALID |
| `db/staging/promote_person.sql` | INSERT into operational tables, set promoted_to_* |
| `db/staging/README.md` | Pipeline documentation |

### Python Stub

| File | Purpose |
|---|---|
| `etl/loader.py` | Minimal CSV → stg_person loader |
| `etl/requirements.txt` | Python dependencies |

### Infrastructure

| File | Purpose |
|---|---|
| `db/docker-compose.yml` | Add `./staging:/staging:ro` volume mount to postgres service |

---

### Task 1: Staging Schema + Import Batch

**Files:**
- Create: `db/migrations/V060__create_staging_schema.sql`
- Create: `db/tests/51_staging_import_batch.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/51_staging_import_batch.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_schema('staging', 'staging schema exists');
SELECT has_table('staging', 'import_batch', 'import_batch table exists');

-- Insert a batch
INSERT INTO staging.import_batch (source_name)
  VALUES ('Test Members Sheet')
  RETURNING batch_id \gset
SELECT pass('import_batch insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM staging.import_batch WHERE batch_id = :'batch_id'),
  'LOADING',
  'batch defaults to LOADING'
);

-- Default source_type
SELECT is(
  (SELECT source_type FROM staging.import_batch WHERE batch_id = :'batch_id'),
  'GOOGLE_SHEET',
  'source_type defaults to GOOGLE_SHEET'
);

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO staging.import_batch (source_name, status) VALUES ('X', 'BOGUS')$$,
  '22P02', NULL, 'invalid batch_status rejected'
);

-- UUID PK generated
SELECT isnt(
  (SELECT batch_id::text FROM staging.import_batch WHERE source_name = 'Test Members Sheet'),
  NULL,
  'batch_id UUID auto-generated'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/51_staging_import_batch.sql
```

Expected: FAIL — schema `staging` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V060__create_staging_schema.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS staging;
COMMENT ON SCHEMA staging IS 'Raw imports from Google Sheets for one-shot migration.';

CREATE TYPE staging.batch_status AS ENUM (
  'LOADING', 'LOADED', 'CLEANSING', 'CLEANSED',
  'VALIDATING', 'VALIDATED', 'PROMOTING', 'PROMOTED', 'FAILED'
);

CREATE TYPE staging.row_status AS ENUM (
  'RAW', 'CLEANSED', 'VALID', 'INVALID', 'PROMOTED', 'SKIPPED'
);

CREATE TABLE staging.import_batch (
  batch_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name   TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'GOOGLE_SHEET',
  row_count     INT,
  status        staging.batch_status NOT NULL DEFAULT 'LOADING',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batch_status ON staging.import_batch(status);

COMMENT ON TABLE staging.import_batch IS 'Import batch tracker. One row per load run.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && docker compose run --rm flyway migrate
```

Expected: V060 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/51_staging_import_batch.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V060__create_staging_schema.sql db/tests/51_staging_import_batch.sql
git commit -m "feat(staging): add schema, enums, import_batch table"
```

---

### Task 2: stg_person Pattern Table

**Files:**
- Create: `db/migrations/V061__staging_stg_person.sql`
- Create: `db/tests/52_staging_stg_person.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/52_staging_stg_person.sql`:

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('staging', 'stg_person', 'stg_person table exists');
SELECT has_fk('staging', 'stg_person', 'stg_person has FK');

-- Setup: create batch
INSERT INTO staging.import_batch (source_name) VALUES ('Test')
  RETURNING batch_id \gset

-- Insert a raw row
INSERT INTO staging.stg_person (batch_id, source_row_number, raw_first_name, raw_last_name, raw_gender)
  VALUES (:'batch_id', 1, 'Juan', 'Dela Cruz', 'MALE')
  RETURNING staging_id \gset
SELECT pass('stg_person insert succeeds');

-- Default row_status
SELECT is(
  (SELECT row_status::text FROM staging.stg_person WHERE staging_id = :staging_id),
  'RAW',
  'row defaults to RAW'
);

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO staging.stg_person (batch_id, row_status)
    VALUES ('00000000-0000-0000-0000-000000000000', 'BOGUS')$$,
  '22P02', NULL, 'invalid row_status rejected'
);

-- FK violation
SELECT throws_ok(
  $$INSERT INTO staging.stg_person (batch_id, raw_first_name)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Bad')$$,
  '23503', NULL, 'invalid batch_id FK rejected'
);

-- Multiple rows same batch
INSERT INTO staging.stg_person (batch_id, source_row_number, raw_first_name, raw_last_name)
  VALUES (:'batch_id', 2, 'Maria', 'Santos');
SELECT is(
  (SELECT count(*)::int FROM staging.stg_person WHERE batch_id = :'batch_id'),
  2,
  'multiple rows per batch allowed'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/52_staging_stg_person.sql
```

Expected: FAIL — table `staging.stg_person` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V061__staging_stg_person.sql`:

```sql
CREATE TABLE staging.stg_person (
  staging_id             BIGSERIAL PRIMARY KEY,
  batch_id               UUID NOT NULL REFERENCES staging.import_batch(batch_id),
  source_row_number      INT,
  row_status             staging.row_status NOT NULL DEFAULT 'RAW',
  raw_first_name         TEXT,
  raw_last_name          TEXT,
  raw_middle_name        TEXT,
  raw_suffix             TEXT,
  raw_gender             TEXT,
  raw_birth_date         TEXT,
  raw_email              TEXT,
  raw_phone              TEXT,
  raw_address_line1      TEXT,
  raw_address_line2      TEXT,
  raw_city               TEXT,
  raw_province           TEXT,
  raw_country            TEXT,
  raw_postal_code        TEXT,
  raw_branch_code        TEXT,
  raw_member_code        TEXT,
  raw_member_stage       TEXT,
  raw_joined_date        TEXT,
  raw_roles              TEXT,
  validation_errors      JSONB,
  promoted_to_person_id  BIGINT,
  promoted_to_member_id  BIGINT,
  promoted_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stg_person_batch ON staging.stg_person(batch_id);
CREATE INDEX idx_stg_person_status ON staging.stg_person(row_status);

COMMENT ON TABLE staging.stg_person IS 'Raw person/member import. All raw_ columns are TEXT. Pattern table for future stg_* tables.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && docker compose run --rm flyway migrate
```

Expected: V061 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/52_staging_stg_person.sql
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V061__staging_stg_person.sql db/tests/52_staging_stg_person.sql
git commit -m "feat(staging): add stg_person pattern table"
```

---

### Task 3: Dedup Tables

**Files:**
- Create: `db/migrations/V062__staging_dedup_tables.sql`
- Create: `db/tests/53_staging_dedup_tables.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/53_staging_dedup_tables.sql`:

```sql
BEGIN;
SELECT plan(10);

SELECT has_table('staging', 'dedup_run', 'dedup_run table exists');
SELECT has_table('staging', 'person_candidate', 'person_candidate table exists');
SELECT has_table('staging', 'person_merge_review', 'person_merge_review table exists');

-- Setup: batch + stg_person rows
INSERT INTO staging.import_batch (source_name) VALUES ('Test')
  RETURNING batch_id \gset
INSERT INTO staging.stg_person (batch_id, raw_first_name, raw_last_name)
  VALUES (:'batch_id', 'Juan', 'Dela Cruz')
  RETURNING staging_id AS sid1 \gset
INSERT INTO staging.stg_person (batch_id, raw_first_name, raw_last_name)
  VALUES (:'batch_id', 'Juan', 'De La Cruz')
  RETURNING staging_id AS sid2 \gset

-- Dedup run
INSERT INTO staging.dedup_run (batch_id, candidates_found, auto_merged, queued_for_review, distinct_persons)
  VALUES (:'batch_id', 2, 0, 1, 1)
  RETURNING run_id \gset
SELECT pass('dedup_run insert succeeds');

-- Person candidates
INSERT INTO staging.person_candidate (run_id, staging_id, first_name, last_name, blocking_key)
  VALUES (:run_id, :sid1, 'Juan', 'Dela Cruz', 'DELACRUZ-J')
  RETURNING candidate_id AS ca \gset
INSERT INTO staging.person_candidate (run_id, staging_id, first_name, last_name, blocking_key)
  VALUES (:run_id, :sid2, 'Juan', 'De La Cruz', 'DELACRUZ-J')
  RETURNING candidate_id AS cb \gset
SELECT pass('person_candidate inserts succeed');

-- Merge review
INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score)
  VALUES (:run_id, :ca, :cb, 0.85)
  RETURNING review_id \gset
SELECT pass('person_merge_review insert succeeds');

-- Default review status
SELECT is(
  (SELECT status::text FROM staging.person_merge_review WHERE review_id = :review_id),
  'PENDING',
  'merge review defaults to PENDING'
);

-- Unique (candidate_a, candidate_b)
PREPARE dup_review AS
  INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score)
  VALUES (:run_id, :ca, :cb, 0.90);
SELECT throws_ok('dup_review', '23505', NULL, 'duplicate (candidate_a, candidate_b) rejected');

-- Invalid merge_review_status
SELECT throws_ok(
  $$INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score, status)
    VALUES (1, 1, 2, 0.5, 'BOGUS')$$,
  '22P02', NULL, 'invalid merge_review_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/53_staging_dedup_tables.sql
```

Expected: FAIL — table `staging.dedup_run` does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V062__staging_dedup_tables.sql`:

```sql
CREATE TYPE staging.merge_review_status AS ENUM ('PENDING', 'MERGED', 'DISTINCT', 'SKIPPED');

CREATE TABLE staging.dedup_run (
  run_id             BIGSERIAL PRIMARY KEY,
  batch_id           UUID REFERENCES staging.import_batch(batch_id),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  candidates_found   INT,
  auto_merged        INT,
  queued_for_review  INT,
  distinct_persons   INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dedup_run_batch ON staging.dedup_run(batch_id);

COMMENT ON TABLE staging.dedup_run IS 'Dedup run tracker. Stats on each deduplication pass.';

CREATE TABLE staging.person_candidate (
  candidate_id       BIGSERIAL PRIMARY KEY,
  run_id             BIGINT NOT NULL REFERENCES staging.dedup_run(run_id),
  staging_id         BIGINT NOT NULL REFERENCES staging.stg_person(staging_id),
  first_name         TEXT,
  last_name          TEXT,
  phone              TEXT,
  email              TEXT,
  birth_date         DATE,
  blocking_key       TEXT,
  resolved_person_id BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_person_candidate_run ON staging.person_candidate(run_id);
CREATE INDEX idx_person_candidate_blocking ON staging.person_candidate(blocking_key);

COMMENT ON TABLE staging.person_candidate IS 'Normalized person candidates for dedup. blocking_key = last_name + first_initial + phone-last-4.';

CREATE TABLE staging.person_merge_review (
  review_id        BIGSERIAL PRIMARY KEY,
  run_id           BIGINT NOT NULL REFERENCES staging.dedup_run(run_id),
  candidate_a_id   BIGINT NOT NULL REFERENCES staging.person_candidate(candidate_id),
  candidate_b_id   BIGINT NOT NULL REFERENCES staging.person_candidate(candidate_id),
  confidence_score NUMERIC NOT NULL,
  status           staging.merge_review_status NOT NULL DEFAULT 'PENDING',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT person_merge_review_pair_unique UNIQUE (candidate_a_id, candidate_b_id)
);

CREATE INDEX idx_merge_review_status ON staging.person_merge_review(status);

COMMENT ON TABLE staging.person_merge_review IS 'Person merge review queue. Pairs at 70-95% confidence for manual resolution.';
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && docker compose run --rm flyway migrate
```

Expected: V062 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/53_staging_dedup_tables.sql
```

Expected: All 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V062__staging_dedup_tables.sql db/tests/53_staging_dedup_tables.sql
git commit -m "feat(staging): add dedup_run, person_candidate, person_merge_review tables"
```

---

### Task 4: Role Grants

**Files:**
- Create: `db/migrations/V063__plan4_roles_and_grants.sql`
- Create: `db/tests/54_plan4_roles.sql`

- [ ] **Step 1: Write the failing test**

Create `db/tests/54_plan4_roles.sql`:

```sql
BEGIN;
SELECT plan(4);

SET LOCAL ROLE app_general;
PREPARE batch_read AS SELECT batch_id FROM staging.import_batch LIMIT 1;
SELECT lives_ok('batch_read', 'app_general can read staging.import_batch');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE stg_person_read AS SELECT staging_id FROM staging.stg_person LIMIT 1;
SELECT lives_ok('stg_person_read', 'app_general can read staging.stg_person');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE dedup_read AS SELECT run_id FROM staging.dedup_run LIMIT 1;
SELECT lives_ok('dedup_read', 'app_pastoral can read staging.dedup_run');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE review_read AS SELECT review_id FROM staging.person_merge_review LIMIT 1;
SELECT lives_ok('review_read', 'app_pastoral can read staging.person_merge_review');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/54_plan4_roles.sql
```

Expected: FAIL — `42501` permission denied for schema staging.

- [ ] **Step 3: Write the migration**

Create `db/migrations/V063__plan4_roles_and_grants.sql`:

```sql
-- app_full: full read/write access
GRANT USAGE ON SCHEMA staging TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA staging TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA staging TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read
GRANT USAGE ON SCHEMA staging TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA staging TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access
GRANT USAGE ON SCHEMA staging TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA staging TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT SELECT ON TABLES TO app_general;
```

- [ ] **Step 4: Run Flyway migrate**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && docker compose run --rm flyway migrate
```

Expected: V063 applied successfully.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/54_plan4_roles.sql
```

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V063__plan4_roles_and_grants.sql db/tests/54_plan4_roles.sql
git commit -m "feat(staging): add role grants for staging schema"
```

---

### Task 5: Docker Volume Mount + Cleanse Script

**Files:**
- Modify: `db/docker-compose.yml`
- Create: `db/staging/cleanse_person.sql`
- Create: `db/tests/55_cleanse_person.sql`

- [ ] **Step 1: Add staging volume mount**

In `db/docker-compose.yml`, add `- ./staging:/staging:ro` to the postgres service volumes (after the tests mount):

```yaml
    volumes:
      - jly_pg_data:/var/lib/postgresql/data
      - ./tests:/tests:ro
      - ./staging:/staging:ro
```

- [ ] **Step 2: Restart postgres to pick up new mount**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && docker compose down && docker compose up -d postgres && docker compose run --rm pgtap_installer && docker compose run --rm flyway migrate
```

- [ ] **Step 3: Write the cleanse script**

Create `db/staging/cleanse_person.sql`:

```sql
-- Cleanse stg_person rows for a given batch.
-- Usage: psql -v batch_id="'<uuid>'" -f cleanse_person.sql
--   or within pgTAP: set batch_id via \gset, then \i /staging/cleanse_person.sql

UPDATE staging.stg_person
SET
  raw_first_name   = NULLIF(TRIM(raw_first_name), ''),
  raw_last_name    = NULLIF(TRIM(raw_last_name), ''),
  raw_middle_name  = NULLIF(TRIM(raw_middle_name), ''),
  raw_suffix       = NULLIF(TRIM(raw_suffix), ''),
  raw_gender       = CASE UPPER(TRIM(COALESCE(raw_gender, '')))
                       WHEN 'M' THEN 'MALE'
                       WHEN 'F' THEN 'FEMALE'
                       WHEN 'MALE' THEN 'MALE'
                       WHEN 'FEMALE' THEN 'FEMALE'
                       WHEN 'UNDISCLOSED' THEN 'UNDISCLOSED'
                       WHEN '' THEN NULL
                       ELSE UPPER(TRIM(raw_gender))
                     END,
  raw_birth_date   = NULLIF(TRIM(raw_birth_date), ''),
  raw_email        = NULLIF(LOWER(TRIM(raw_email)), ''),
  raw_phone        = NULLIF(REGEXP_REPLACE(TRIM(COALESCE(raw_phone, '')), '[^0-9+]', '', 'g'), ''),
  raw_address_line1 = NULLIF(TRIM(raw_address_line1), ''),
  raw_address_line2 = NULLIF(TRIM(raw_address_line2), ''),
  raw_city         = NULLIF(TRIM(raw_city), ''),
  raw_province     = NULLIF(TRIM(raw_province), ''),
  raw_country      = NULLIF(UPPER(TRIM(raw_country)), ''),
  raw_postal_code  = NULLIF(TRIM(raw_postal_code), ''),
  raw_branch_code  = NULLIF(UPPER(TRIM(raw_branch_code)), ''),
  raw_member_code  = NULLIF(TRIM(raw_member_code), ''),
  raw_member_stage = NULLIF(UPPER(TRIM(raw_member_stage)), ''),
  raw_joined_date  = NULLIF(TRIM(raw_joined_date), ''),
  raw_roles        = NULLIF(TRIM(raw_roles), ''),
  row_status       = 'CLEANSED'
WHERE batch_id = :'batch_id'
  AND row_status = 'RAW';

UPDATE staging.import_batch
SET status = 'CLEANSED'
WHERE batch_id = :'batch_id';
```

- [ ] **Step 4: Write the integration test**

Create `db/tests/55_cleanse_person.sql`:

```sql
BEGIN;
SELECT plan(8);

-- Setup: batch + raw rows
INSERT INTO staging.import_batch (source_name) VALUES ('Cleanse Test')
  RETURNING batch_id \gset

INSERT INTO staging.stg_person
  (batch_id, source_row_number, raw_first_name, raw_last_name, raw_gender, raw_phone, raw_email, raw_branch_code)
VALUES
  (:'batch_id', 1, '  Juan  ', '  Dela Cruz  ', 'm', '(0917) 123-4567', '  JUAN@EMAIL.COM  ', '  mnl-hq  ');

INSERT INTO staging.stg_person
  (batch_id, source_row_number, raw_first_name, raw_last_name, raw_gender, raw_phone)
VALUES
  (:'batch_id', 2, 'Maria', 'Santos', 'F', '');

-- Run cleanse
\i /staging/cleanse_person.sql

-- Verify row 1
SELECT is(
  (SELECT raw_first_name FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  'Juan',
  'first name trimmed'
);

SELECT is(
  (SELECT raw_gender FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  'MALE',
  'gender m normalized to MALE'
);

SELECT is(
  (SELECT raw_phone FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  '09171234567',
  'phone stripped to digits'
);

SELECT is(
  (SELECT raw_email FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  'juan@email.com',
  'email lowercased and trimmed'
);

SELECT is(
  (SELECT raw_branch_code FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  'MNL-HQ',
  'branch code uppercased and trimmed'
);

-- Verify row 2: empty phone becomes NULL
SELECT is(
  (SELECT raw_phone FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 2),
  NULL,
  'empty phone normalized to NULL'
);

-- Verify row_status updated
SELECT is(
  (SELECT count(*)::int FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND row_status = 'CLEANSED'),
  2,
  'both rows set to CLEANSED'
);

-- Verify batch status
SELECT is(
  (SELECT status::text FROM staging.import_batch WHERE batch_id = :'batch_id'),
  'CLEANSED',
  'batch status updated to CLEANSED'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/55_cleanse_person.sql
```

Expected: All 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/docker-compose.yml db/staging/cleanse_person.sql db/tests/55_cleanse_person.sql
git commit -m "feat(staging): add cleanse_person pipeline script with integration test"
```

---

### Task 6: Validate Script

**Files:**
- Create: `db/staging/validate_person.sql`
- Create: `db/tests/56_validate_person.sql`

- [ ] **Step 1: Write the validate script**

Create `db/staging/validate_person.sql`:

```sql
-- Validate stg_person rows for a given batch.
-- Usage: psql -v batch_id="'<uuid>'" -f validate_person.sql

UPDATE staging.stg_person
SET validation_errors = '[]'::jsonb
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED';

-- Required: raw_first_name
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_first_name', 'error', 'required'))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND (raw_first_name IS NULL OR raw_first_name = '');

-- Required: raw_last_name
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_last_name', 'error', 'required'))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND (raw_last_name IS NULL OR raw_last_name = '');

-- Gender must be valid enum value if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_gender', 'error', 'invalid value: ' || raw_gender))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_gender IS NOT NULL
  AND raw_gender NOT IN ('MALE', 'FEMALE', 'UNDISCLOSED');

-- Branch code must exist in core.branch if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_branch_code', 'error', 'unknown branch: ' || raw_branch_code))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_branch_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM core.branch WHERE code = stg_person.raw_branch_code);

-- Member stage must be valid lifecycle_stage if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_member_stage', 'error', 'unknown stage: ' || raw_member_stage))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_member_stage IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM membership.lifecycle_stage WHERE stage_code = stg_person.raw_member_stage);

-- Set final status: VALID if no errors, INVALID if errors present
UPDATE staging.stg_person
SET row_status = CASE
  WHEN jsonb_array_length(validation_errors) = 0 THEN 'VALID'
  ELSE 'INVALID'
END::staging.row_status
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED';

UPDATE staging.import_batch
SET status = 'VALIDATED'
WHERE batch_id = :'batch_id';
```

- [ ] **Step 2: Write the integration test**

Create `db/tests/56_validate_person.sql`:

```sql
BEGIN;
SELECT plan(7);

-- Setup: region + branch for FK validation
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL-HQ', 'Manila HQ', :region_id, 'LOCAL', 'PH', 'Asia/Manila');

-- Setup: batch with pre-cleansed rows
INSERT INTO staging.import_batch (source_name, status)
  VALUES ('Validate Test', 'CLEANSED')
  RETURNING batch_id \gset

-- Row 1: valid row
INSERT INTO staging.stg_person
  (batch_id, source_row_number, row_status, raw_first_name, raw_last_name, raw_gender, raw_branch_code, raw_member_stage)
VALUES
  (:'batch_id', 1, 'CLEANSED', 'Juan', 'Dela Cruz', 'MALE', 'MNL-HQ', 'FTV');

-- Row 2: missing last_name + bad gender + bad branch
INSERT INTO staging.stg_person
  (batch_id, source_row_number, row_status, raw_first_name, raw_last_name, raw_gender, raw_branch_code)
VALUES
  (:'batch_id', 2, 'CLEANSED', 'Maria', NULL, 'BADGENDER', 'NONEXIST');

-- Row 3: missing first_name
INSERT INTO staging.stg_person
  (batch_id, source_row_number, row_status, raw_first_name, raw_last_name)
VALUES
  (:'batch_id', 3, 'CLEANSED', NULL, 'Santos');

-- Run validate
\i /staging/validate_person.sql

-- Row 1: should be VALID
SELECT is(
  (SELECT row_status::text FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  'VALID',
  'valid row marked VALID'
);

SELECT is(
  (SELECT jsonb_array_length(validation_errors) FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND source_row_number = 1),
  0,
  'valid row has zero errors'
);

-- Row 2: should be INVALID with 3 errors (missing last_name, bad gender, bad branch)
SELECT is(
  (SELECT row_status::text FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 2),
  'INVALID',
  'invalid row marked INVALID'
);

SELECT is(
  (SELECT jsonb_array_length(validation_errors) FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND source_row_number = 2),
  3,
  'invalid row has 3 errors (last_name, gender, branch)'
);

-- Row 3: should be INVALID with 1 error (missing first_name)
SELECT is(
  (SELECT jsonb_array_length(validation_errors) FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND source_row_number = 3),
  1,
  'row 3 has 1 error (missing first_name)'
);

-- Batch status
SELECT is(
  (SELECT status::text FROM staging.import_batch WHERE batch_id = :'batch_id'),
  'VALIDATED',
  'batch status updated to VALIDATED'
);

-- Error detail queryable
SELECT is(
  (SELECT validation_errors->0->>'field' FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND source_row_number = 3),
  'raw_first_name',
  'error detail field is queryable'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run test**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/56_validate_person.sql
```

Expected: All 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add db/staging/validate_person.sql db/tests/56_validate_person.sql
git commit -m "feat(staging): add validate_person pipeline script with integration test"
```

---

### Task 7: Promote Script

**Files:**
- Create: `db/staging/promote_person.sql`
- Create: `db/tests/57_promote_person.sql`

- [ ] **Step 1: Write the promote script**

Create `db/staging/promote_person.sql`:

```sql
-- Promote stg_person rows for a given batch into operational tables.
-- Usage: psql -v batch_id="'<uuid>'" -f promote_person.sql
-- Runs in a single transaction (caller wraps in BEGIN/COMMIT or relies on psql autocommit per file).

DO $$
DECLARE
  r RECORD;
  v_address_id  BIGINT;
  v_person_id   BIGINT;
  v_member_id   BIGINT;
  v_branch_id   BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM staging.stg_person
    WHERE batch_id = :'batch_id'
      AND row_status = 'VALID'
    ORDER BY staging_id
  LOOP
    v_address_id := NULL;
    v_person_id  := NULL;
    v_member_id  := NULL;

    -- 1. Address (if line1 present)
    IF r.raw_address_line1 IS NOT NULL THEN
      INSERT INTO core.address (line1, line2, city, province, postal_code, country_code)
      VALUES (
        r.raw_address_line1,
        r.raw_address_line2,
        r.raw_city,
        r.raw_province,
        r.raw_postal_code,
        COALESCE(r.raw_country, 'PH')
      )
      RETURNING address_id INTO v_address_id;
    END IF;

    -- 2. Person
    INSERT INTO core.person (first_name, last_name, middle_name, suffix, gender, date_of_birth)
    VALUES (
      r.raw_first_name,
      r.raw_last_name,
      r.raw_middle_name,
      r.raw_suffix,
      CASE WHEN r.raw_gender IS NOT NULL THEN r.raw_gender::core.gender ELSE NULL END,
      CASE WHEN r.raw_birth_date IS NOT NULL THEN r.raw_birth_date::date ELSE NULL END
    )
    RETURNING person_id INTO v_person_id;

    -- 3. Contact info: email
    IF r.raw_email IS NOT NULL THEN
      INSERT INTO core.contact_info (person_id, type, value, is_primary)
      VALUES (v_person_id, 'EMAIL', r.raw_email, true);
    END IF;

    -- 4. Contact info: phone
    IF r.raw_phone IS NOT NULL THEN
      INSERT INTO core.contact_info (person_id, type, value, is_primary)
      VALUES (v_person_id, 'MOBILE', r.raw_phone, true);
    END IF;

    -- 5. Member (if member_code present)
    IF r.raw_member_code IS NOT NULL THEN
      SELECT branch_id INTO v_branch_id
      FROM core.branch WHERE code = r.raw_branch_code;

      INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
      VALUES (
        v_person_id,
        v_branch_id,
        r.raw_member_code,
        COALESCE(r.raw_member_stage, 'FTV'),
        CASE WHEN r.raw_joined_date IS NOT NULL THEN r.raw_joined_date::timestamptz
             ELSE now() END
      )
      RETURNING member_id INTO v_member_id;
    END IF;

    -- 6. Update staging row
    UPDATE staging.stg_person
    SET promoted_to_person_id = v_person_id,
        promoted_to_member_id = v_member_id,
        promoted_at = now(),
        row_status = 'PROMOTED'
    WHERE staging_id = r.staging_id;
  END LOOP;
END $$;

UPDATE staging.import_batch
SET status = 'PROMOTED', completed_at = now()
WHERE batch_id = :'batch_id';
```

- [ ] **Step 2: Write the integration test**

Create `db/tests/57_promote_person.sql`:

```sql
BEGIN;
SELECT plan(9);

-- Setup: region + branch
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL-HQ', 'Manila HQ', :region_id, 'LOCAL', 'PH', 'Asia/Manila');

-- Setup: batch with pre-validated rows
INSERT INTO staging.import_batch (source_name, status)
  VALUES ('Promote Test', 'VALIDATED')
  RETURNING batch_id \gset

-- Row 1: full person + member
INSERT INTO staging.stg_person
  (batch_id, source_row_number, row_status,
   raw_first_name, raw_last_name, raw_gender, raw_birth_date,
   raw_email, raw_phone,
   raw_address_line1, raw_city, raw_country,
   raw_branch_code, raw_member_code, raw_member_stage, raw_joined_date)
VALUES
  (:'batch_id', 1, 'VALID',
   'Juan', 'Dela Cruz', 'MALE', '1990-05-15',
   'juan@email.com', '09171234567',
   '1 Faith Ave', 'Manila', 'PH',
   'MNL-HQ', 'MNL-2026-000001', 'FTV', '2026-01-15');

-- Row 2: person only (no member_code)
INSERT INTO staging.stg_person
  (batch_id, source_row_number, row_status,
   raw_first_name, raw_last_name, raw_email)
VALUES
  (:'batch_id', 2, 'VALID',
   'Maria', 'Santos', 'maria@email.com');

-- Run promote
\i /staging/promote_person.sql

-- Row 1: person created
SELECT is(
  (SELECT count(*)::int FROM core.person WHERE first_name = 'Juan' AND last_name = 'Dela Cruz'),
  1,
  'Juan promoted to core.person'
);

-- Row 1: member created
SELECT is(
  (SELECT count(*)::int FROM membership.member WHERE member_code = 'MNL-2026-000001'),
  1,
  'Juan promoted to membership.member'
);

-- Row 1: address created
SELECT is(
  (SELECT count(*)::int FROM core.address WHERE line1 = '1 Faith Ave'),
  1,
  'address promoted to core.address'
);

-- Row 1: contact info created (email + phone)
SELECT is(
  (SELECT count(*)::int FROM core.contact_info
   WHERE person_id = (SELECT person_id FROM core.person WHERE first_name = 'Juan' AND last_name = 'Dela Cruz')),
  2,
  'two contact_info rows for Juan (email + phone)'
);

-- Row 2: person created, no member
SELECT is(
  (SELECT count(*)::int FROM core.person WHERE first_name = 'Maria' AND last_name = 'Santos'),
  1,
  'Maria promoted to core.person'
);

SELECT is(
  (SELECT promoted_to_member_id FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 2),
  NULL,
  'Maria has no member_id (person only)'
);

-- Staging rows updated
SELECT is(
  (SELECT count(*)::int FROM staging.stg_person
   WHERE batch_id = :'batch_id' AND row_status = 'PROMOTED'),
  2,
  'both rows marked PROMOTED'
);

-- promoted_to_person_id set
SELECT isnt(
  (SELECT promoted_to_person_id FROM staging.stg_person WHERE batch_id = :'batch_id' AND source_row_number = 1),
  NULL,
  'promoted_to_person_id set for row 1'
);

-- Batch status
SELECT is(
  (SELECT status::text FROM staging.import_batch WHERE batch_id = :'batch_id'),
  'PROMOTED',
  'batch status updated to PROMOTED'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run test**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/57_promote_person.sql
```

Expected: All 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add db/staging/promote_person.sql db/tests/57_promote_person.sql
git commit -m "feat(staging): add promote_person pipeline script with integration test"
```

---

### Task 8: Python Loader Stub

**Files:**
- Create: `etl/loader.py`
- Create: `etl/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

Create `etl/requirements.txt`:

```
psycopg2-binary>=2.9
pandas>=2.0
gspread>=6.0
```

- [ ] **Step 2: Create loader.py**

Create `etl/loader.py`:

```python
#!/usr/bin/env python3
"""Minimal CSV → staging.stg_person loader.

Usage:
    python loader.py --csv path/to/members.csv

Requires DATABASE_URL environment variable:
    export DATABASE_URL="postgresql://jly_admin:localdevpassword@localhost:5432/jly"

CSV headers are mapped to raw_* columns via HEADER_MAP. Unknown headers are ignored.
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

HEADER_MAP = {
    "first_name": "raw_first_name",
    "last_name": "raw_last_name",
    "middle_name": "raw_middle_name",
    "suffix": "raw_suffix",
    "gender": "raw_gender",
    "birth_date": "raw_birth_date",
    "email": "raw_email",
    "phone": "raw_phone",
    "address_line1": "raw_address_line1",
    "address_line2": "raw_address_line2",
    "city": "raw_city",
    "province": "raw_province",
    "country": "raw_country",
    "postal_code": "raw_postal_code",
    "branch_code": "raw_branch_code",
    "member_code": "raw_member_code",
    "member_stage": "raw_member_stage",
    "joined_date": "raw_joined_date",
    "roles": "raw_roles",
}


def load_csv(csv_path: str, conn_url: str) -> str:
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    mapped_cols = {}
    for csv_col in df.columns:
        key = csv_col.strip().lower().replace(" ", "_")
        if key in HEADER_MAP:
            mapped_cols[csv_col] = HEADER_MAP[key]

    if not mapped_cols:
        print(f"No recognized columns in {csv_path}. Expected: {list(HEADER_MAP.keys())}")
        sys.exit(1)

    df = df.rename(columns=mapped_cols)
    raw_cols = [c for c in df.columns if c.startswith("raw_")]

    conn = psycopg2.connect(conn_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO staging.import_batch (source_name, status) "
                "VALUES (%s, 'LOADING') RETURNING batch_id",
                (Path(csv_path).stem,),
            )
            batch_id = cur.fetchone()[0]

            insert_cols = ["batch_id", "source_row_number"] + raw_cols
            placeholders = ", ".join(["%s"] * len(insert_cols))
            sql = f"INSERT INTO staging.stg_person ({', '.join(insert_cols)}) VALUES ({placeholders})"

            rows = []
            for idx, row in df.iterrows():
                values = [str(batch_id), idx + 1] + [
                    row[c] if row[c] != "" else None for c in raw_cols
                ]
                rows.append(values)

            cur.executemany(sql, rows)

            cur.execute(
                "UPDATE staging.import_batch SET row_count = %s, status = 'LOADED' "
                "WHERE batch_id = %s",
                (len(rows), str(batch_id)),
            )

        conn.commit()
        print(f"Loaded {len(rows)} rows into stg_person (batch_id={batch_id})")
        return str(batch_id)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Load CSV into staging.stg_person")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    args = parser.parse_args()

    conn_url = os.environ.get("DATABASE_URL")
    if not conn_url:
        print("DATABASE_URL environment variable not set")
        sys.exit(1)

    if not Path(args.csv).exists():
        print(f"File not found: {args.csv}")
        sys.exit(1)

    load_csv(args.csv, conn_url)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add etl/loader.py etl/requirements.txt
git commit -m "feat(staging): add minimal Python CSV loader stub"
```

---

### Task 9: README

**Files:**
- Create: `db/staging/README.md`

- [ ] **Step 1: Write the README**

Create `db/staging/README.md`:

```markdown
# Staging Pipeline

One-shot migration pipeline: load data from Google Sheets (or CSV) into staging tables, cleanse, validate, and promote to operational schemas.

## Pipeline Phases

```
1. LOAD      →  Python loader inserts raw CSV/Sheet rows into stg_person
2. CLEANSE   →  SQL normalizes raw_ columns (trim, uppercase, format)
3. VALIDATE  →  SQL checks business rules, fills validation_errors JSONB
4. PROMOTE   →  SQL inserts valid rows into core/membership tables
```

## Running the Pipeline

### 1. Load from CSV

```bash
export DATABASE_URL="postgresql://jly_admin:localdevpassword@localhost:5432/jly"
python etl/loader.py --csv path/to/members.csv
# Note the batch_id printed to stdout
```

### 2. Cleanse

```bash
psql "$DATABASE_URL" -v batch_id="'<batch_id>'" -f db/staging/cleanse_person.sql
```

### 3. Validate

```bash
psql "$DATABASE_URL" -v batch_id="'<batch_id>'" -f db/staging/validate_person.sql
```

### 4. Check for invalid rows

```sql
SELECT staging_id, raw_first_name, raw_last_name, validation_errors
FROM staging.stg_person
WHERE batch_id = '<batch_id>' AND row_status = 'INVALID';
```

Fix issues in the source CSV and re-load, or update staging rows manually.

### 5. Promote

```bash
psql "$DATABASE_URL" -v batch_id="'<batch_id>'" -f db/staging/promote_person.sql
```

## Adding a New Sheet

1. Create a new staging table following the pattern:
   - `staging_id BIGSERIAL PRIMARY KEY`
   - `batch_id UUID NOT NULL FK → import_batch`
   - `source_row_number INT`
   - `row_status staging.row_status NOT NULL DEFAULT 'RAW'`
   - `raw_<column> TEXT` for each source column
   - `validation_errors JSONB`
   - `promoted_to_<target>_id BIGINT` for each target table
   - `promoted_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

2. Write `cleanse_<name>.sql` — normalize raw_ columns
3. Write `validate_<name>.sql` — check rules, fill validation_errors
4. Write `promote_<name>.sql` — INSERT into operational tables

## Error Handling

- Invalid rows stay in staging with `row_status = 'INVALID'`
- `validation_errors` is a JSONB array: `[{"field": "raw_gender", "error": "invalid value: X"}]`
- Fix in source and re-load, or UPDATE staging rows directly
- Re-run validate after fixes
```

- [ ] **Step 2: Commit**

```bash
git add db/staging/README.md
git commit -m "docs(staging): add pipeline README"
```

---

### Task 10: E2E Smoke Test Update

**Files:**
- Modify: `db/tests/99_smoke_e2e.sql`

- [ ] **Step 1: Update smoke test**

In `db/tests/99_smoke_e2e.sql`, change the plan count from 21 to 24, and append the following block **before** the final `SELECT * FROM finish();` line (after `SELECT pass('education end-to-end complete');`):

```sql
-- ==================== Plan 4: Staging ====================

-- Create a batch, load a raw row, verify tracking
INSERT INTO staging.import_batch (source_name)
  VALUES ('Smoke Test Sheet')
  RETURNING batch_id AS stg_batch \gset

INSERT INTO staging.stg_person
  (batch_id, source_row_number, raw_first_name, raw_last_name, raw_gender, raw_branch_code)
VALUES
  (:'stg_batch', 1, 'Staging', 'Test', 'MALE', 'MNL-HQ');

SELECT is(
  (SELECT row_status::text FROM staging.stg_person
   WHERE batch_id = :'stg_batch' AND source_row_number = 1),
  'RAW',
  'staging row starts as RAW'
);

-- Dedup infrastructure: create run + candidate
INSERT INTO staging.dedup_run (batch_id, candidates_found)
  VALUES (:'stg_batch', 1)
  RETURNING run_id AS stg_run \gset

INSERT INTO staging.person_candidate
  (run_id, staging_id, first_name, last_name, blocking_key)
VALUES
  (:stg_run,
   (SELECT staging_id FROM staging.stg_person WHERE batch_id = :'stg_batch' LIMIT 1),
   'Staging', 'Test', 'TEST-S');

SELECT is(
  (SELECT count(*)::int FROM staging.person_candidate WHERE run_id = :stg_run),
  1,
  'dedup candidate created'
);

SELECT pass('staging end-to-end complete');
```

- [ ] **Step 2: Run the full smoke test**

```bash
cd /c/Users/delson.deperalta/jly-church-db/db && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -f /tests/99_smoke_e2e.sql
```

Expected: All 24 tests pass.

- [ ] **Step 3: Run all staging tests**

```bash
for t in 51 52 53 54 55 56 57; do MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker exec -i jly_postgres psql -U jly_admin -d jly -X -q -f "/tests/${t}_*.sql" 2>&1 | grep -c "not ok" | xargs -I{} echo "Test $t: {} failures"; done
```

Expected: All 0 failures.

- [ ] **Step 4: Commit**

```bash
git add db/tests/99_smoke_e2e.sql
git commit -m "test(staging): update E2E smoke test with staging assertions"
```

- [ ] **Step 5: Tag the milestone**

```bash
git tag plan-4-staging-complete
```
