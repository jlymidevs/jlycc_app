# JLY Church Database — Foundation Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working PostgreSQL database with the `core` and `membership` schemas, all reusable infrastructure (history triggers, soft-delete views, PII roles), and a local dev environment, so that subsequent plans (operational, specialized, migration) can FK into a stable foundation.

**Architecture:** PostgreSQL 16 on Cloud SQL for production; local development uses Docker Compose (Postgres + Flyway + pgTAP). Schema is split into PostgreSQL schemas per bounded context. SQL migrations are versioned and applied by Flyway. Tests are written in pgTAP and live in the database itself.

**Tech Stack:**
- PostgreSQL 16 (Cloud SQL prod, Docker Postgres for local dev)
- Flyway Community Edition for migrations (`flyway/flyway:10` image)
- pgTAP for schema/constraint/trigger tests
- Docker Compose for local orchestration
- Bash (Git Bash on Windows) for orchestration scripts

**Spec reference:** `docs/superpowers/specs/2026-04-19-jly-church-database-design.md` — sections 4.1 (`core`), 4.2 (`membership`), 5 (cross-cutting conventions).

**Out of scope for this plan:** `ministries`, `events`, `attendance`, `programs`, `missions`, `education`, `staging`, migration tooling. Those are Plans 2-4.

---

## File structure created by this plan

```
jly-church-db/
├── db/
│   ├── docker-compose.yml
│   ├── flyway.conf
│   ├── README.md
│   ├── migrations/
│   │   ├── V001__create_schemas.sql
│   │   ├── V002__create_extensions.sql
│   │   ├── V003__updated_at_trigger_function.sql
│   │   ├── V004__history_trigger_function.sql
│   │   ├── V005__core_region.sql
│   │   ├── V006__core_branch.sql
│   │   ├── V007__core_address.sql
│   │   ├── V008__core_person.sql
│   │   ├── V009__core_contact_info.sql
│   │   ├── V010__core_person_address.sql
│   │   ├── V011__core_household.sql
│   │   ├── V012__core_household_member.sql
│   │   ├── V013__core_kinship.sql
│   │   ├── V014__core_kinship_bidirectional_view.sql
│   │   ├── V015__membership_lifecycle_stage.sql
│   │   ├── V016__membership_role.sql
│   │   ├── V017__membership_member.sql
│   │   ├── V018__membership_lifecycle_stage_history.sql
│   │   ├── V019__membership_branch_membership_history.sql
│   │   ├── V020__membership_member_role.sql
│   │   ├── V021__membership_regular_member_application.sql
│   │   ├── V022__membership_pastoral_care_assignment.sql
│   │   ├── V023__core_active_views.sql
│   │   ├── V024__membership_active_views.sql
│   │   ├── V025__db_roles.sql
│   │   ├── R__seed_lifecycle_stages.sql
│   │   └── R__seed_roles.sql
│   └── tests/
│       ├── run_tests.sh
│       ├── 01_schemas.sql
│       ├── 02_extensions.sql
│       ├── 03_trigger_functions.sql
│       ├── 04_core_region.sql
│       ├── 05_core_branch.sql
│       ├── 06_core_address.sql
│       ├── 07_core_person.sql
│       ├── 08_core_contact_info.sql
│       ├── 09_core_person_address.sql
│       ├── 10_core_household.sql
│       ├── 11_core_household_member.sql
│       ├── 12_core_kinship.sql
│       ├── 13_core_kinship_view.sql
│       ├── 14_membership_lifecycle_stage.sql
│       ├── 15_membership_role.sql
│       ├── 16_membership_member.sql
│       ├── 17_membership_history_tables.sql
│       ├── 18_membership_history_triggers.sql
│       ├── 19_membership_member_role.sql
│       ├── 20_membership_application_pcm.sql
│       ├── 21_active_views.sql
│       └── 22_db_roles.sql
└── docs/superpowers/plans/2026-04-19-foundation-implementation.md  ← this file
```

**File design rationale:** One migration per table (or per logical unit) keeps each commit small and easy to review. Tests are numbered to mirror migrations. Flyway uses `V*` for versioned migrations and `R__` (repeatable) for seed data so seeds re-apply cleanly when re-run.

---

## Task 1: Project scaffolding (Docker, Flyway, README, schemas)

**Files:**
- Create: `db/docker-compose.yml`
- Create: `db/flyway.conf`
- Create: `db/README.md`
- Create: `db/migrations/V001__create_schemas.sql`
- Create: `db/tests/run_tests.sh`
- Create: `db/tests/01_schemas.sql`

- [ ] **Step 1: Create the directory structure**

```bash
cd /c/Users/delson.deperalta/jly-church-db
mkdir -p db/migrations db/tests
```

- [ ] **Step 2: Write `db/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    container_name: jly_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: jly
      POSTGRES_USER: jly_admin
      POSTGRES_PASSWORD: localdevpassword
    ports:
      - "5432:5432"
    volumes:
      - jly_pg_data:/var/lib/postgresql/data
      - ./tests:/tests:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jly_admin -d jly"]
      interval: 5s
      timeout: 3s
      retries: 10

  pgtap_installer:
    image: postgres:16
    depends_on:
      postgres:
        condition: service_healthy
    entrypoint: >
      bash -c "
        apt-get update && apt-get install -y postgresql-16-pgtap &&
        PGPASSWORD=localdevpassword psql -h postgres -U jly_admin -d jly -c 'CREATE EXTENSION IF NOT EXISTS pgtap;'
      "

  flyway:
    image: flyway/flyway:10
    depends_on:
      pgtap_installer:
        condition: service_completed_successfully
    volumes:
      - ./migrations:/flyway/sql
      - ./flyway.conf:/flyway/conf/flyway.conf
    command: migrate

volumes:
  jly_pg_data:
```

- [ ] **Step 3: Write `db/flyway.conf`**

```properties
flyway.url=jdbc:postgresql://postgres:5432/jly
flyway.user=jly_admin
flyway.password=localdevpassword
flyway.schemas=core,membership,public
flyway.defaultSchema=public
flyway.locations=filesystem:/flyway/sql
flyway.baselineOnMigrate=true
flyway.validateOnMigrate=true
```

- [ ] **Step 4: Write `db/README.md`**

````markdown
# JLY Church Database — Local Development

## Prerequisites
- Docker Desktop (Windows/macOS) or Docker Engine + Compose v2
- Git Bash (Windows) or any POSIX shell

## Start everything
```bash
cd db
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
```

## Run tests
```bash
./tests/run_tests.sh
```

## Reset database (wipes all data)
```bash
docker compose down -v
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
```

## Connect with psql
```bash
docker exec -it jly_postgres psql -U jly_admin -d jly
```

## Production deploy (Cloud SQL)
Update `flyway.conf` with the Cloud SQL connection string and run `flyway migrate`. The migrations are environment-agnostic.
````

- [ ] **Step 5: Write the test for schemas** at `db/tests/01_schemas.sql`

```sql
BEGIN;
SELECT plan(2);

SELECT has_schema('core', 'core schema exists');
SELECT has_schema('membership', 'membership schema exists');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 6: Write `db/tests/run_tests.sh`** (runs all numbered tests in order)

```bash
#!/usr/bin/env bash
set -euo pipefail

CONTAINER=jly_postgres
DB=jly
USER=jly_admin

cd "$(dirname "$0")"

for f in $(ls *.sql | sort); do
  echo "=== $f ==="
  docker exec -i $CONTAINER psql -U $USER -d $DB -X -q -f "/tests/$f"
done
```

Make it executable:
```bash
chmod +x db/tests/run_tests.sh
```

- [ ] **Step 7: Verify the test fails** (no migrations applied yet)

```bash
cd db
docker compose up -d postgres
docker compose run --rm pgtap_installer
./tests/run_tests.sh
```

Expected output: `01_schemas.sql` reports `not ok 1 - core schema exists` and `not ok 2 - membership schema exists`.

- [ ] **Step 8: Write the migration** at `db/migrations/V001__create_schemas.sql`

```sql
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS membership;

COMMENT ON SCHEMA core IS 'Foundation entities: persons, branches, regions, households, kinship';
COMMENT ON SCHEMA membership IS 'Member records, lifecycle stages, roles, pastoral care assignments';
```

- [ ] **Step 9: Apply the migration and re-run tests**

```bash
cd db
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: `01_schemas.sql` shows `ok 1 - core schema exists` and `ok 2 - membership schema exists`.

- [ ] **Step 10: Commit**

```bash
cd /c/Users/delson.deperalta/jly-church-db
git init
echo "db/.flyway/" > .gitignore
git add db/docker-compose.yml db/flyway.conf db/README.md \
        db/migrations/V001__create_schemas.sql \
        db/tests/run_tests.sh db/tests/01_schemas.sql .gitignore
git commit -m "feat(db): scaffold project with Docker, Flyway, pgTAP; create core & membership schemas"
```

---

## Task 2: Extensions and reusable trigger functions

**Files:**
- Create: `db/migrations/V002__create_extensions.sql`
- Create: `db/migrations/V003__updated_at_trigger_function.sql`
- Create: `db/migrations/V004__history_trigger_function.sql`
- Create: `db/tests/02_extensions.sql`
- Create: `db/tests/03_trigger_functions.sql`

- [ ] **Step 1: Write the test for extensions** at `db/tests/02_extensions.sql`

```sql
BEGIN;
SELECT plan(3);

SELECT has_extension('citext', 'citext extension exists');
SELECT has_extension('pg_trgm', 'pg_trgm extension exists');
SELECT has_extension('pgcrypto', 'pgcrypto extension exists');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write the test for trigger functions** at `db/tests/03_trigger_functions.sql`

```sql
BEGIN;
SELECT plan(2);

SELECT has_function(
  'public', 'set_updated_at',
  ARRAY[]::text[],
  'set_updated_at trigger function exists'
);

SELECT has_function(
  'public', 'record_history',
  ARRAY[]::text[],
  'record_history trigger function exists'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests to verify failure**

```bash
./tests/run_tests.sh
```

Expected: `02_extensions.sql` and `03_trigger_functions.sql` fail.

- [ ] **Step 4: Write `db/migrations/V002__create_extensions.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

- [ ] **Step 5: Write `db/migrations/V003__updated_at_trigger_function.sql`**

```sql
-- Generic trigger to maintain an updated_at column on row UPDATE.
-- Usage:
--   CREATE TRIGGER trg_<table>_updated_at
--     BEFORE UPDATE ON <schema>.<table>
--     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE UPDATE trigger that sets NEW.updated_at = now() on every row update.';
```

- [ ] **Step 6: Write `db/migrations/V004__history_trigger_function.sql`**

```sql
-- Generic trigger to record a history row when watched columns change.
-- Configured per-table via trigger arguments:
--   TG_ARGV[0] = history table (e.g. 'membership.lifecycle_stage_history')
--   TG_ARGV[1] = parent FK column on history table (e.g. 'member_id')
--   TG_ARGV[2] = comma-separated list of "watched_col:from_col:to_col" mappings
--                (e.g. 'current_stage:from_stage:to_stage')
--
-- Each trigger creation specifies which columns to watch and where to write the
-- before/after values in the history table.
CREATE OR REPLACE FUNCTION public.record_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  history_table text := TG_ARGV[0];
  parent_fk_col text := TG_ARGV[1];
  mappings text := TG_ARGV[2];
  mapping text;
  parts text[];
  watched_col text;
  from_col text;
  to_col text;
  old_val text;
  new_val text;
  cols text := parent_fk_col;
  vals text;
  parent_pk_value text;
BEGIN
  -- Resolve parent PK value from NEW
  EXECUTE format('SELECT ($1).%I::text', TG_TABLE_NAME || '_id')
    INTO parent_pk_value
    USING NEW;
  vals := quote_literal(parent_pk_value);

  FOREACH mapping IN ARRAY string_to_array(mappings, ',')
  LOOP
    parts := string_to_array(mapping, ':');
    watched_col := parts[1];
    from_col := parts[2];
    to_col := parts[3];

    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', watched_col, watched_col)
      INTO old_val, new_val
      USING OLD, NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      cols := cols || ', ' || from_col || ', ' || to_col || ', changed_at';
      vals := vals || ', '
              || COALESCE(quote_literal(old_val), 'NULL') || ', '
              || COALESCE(quote_literal(new_val), 'NULL') || ', '
              || quote_literal(now()::text);
      EXECUTE format('INSERT INTO %s (%s) VALUES (%s)', history_table, cols, vals);
      cols := parent_fk_col;
      vals := quote_literal(parent_pk_value);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_history() IS
  'Generic AFTER UPDATE trigger; emits a row into a history table when watched columns change. Wire it up via CREATE TRIGGER ... EXECUTE FUNCTION public.record_history(history_table, parent_fk_col, mappings).';
```

- [ ] **Step 7: Apply migrations and re-run tests**

```bash
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: `02_extensions.sql` and `03_trigger_functions.sql` pass.

- [ ] **Step 8: Commit**

```bash
git add db/migrations/V002__create_extensions.sql \
        db/migrations/V003__updated_at_trigger_function.sql \
        db/migrations/V004__history_trigger_function.sql \
        db/tests/02_extensions.sql db/tests/03_trigger_functions.sql
git commit -m "feat(db): add citext/pg_trgm/pgcrypto extensions and reusable updated_at + history trigger functions"
```

---

## Task 3: `core.region` and `core.branch`

**Files:**
- Create: `db/migrations/V005__core_region.sql`
- Create: `db/migrations/V006__core_branch.sql`
- Create: `db/tests/04_core_region.sql`
- Create: `db/tests/05_core_branch.sql`

- [ ] **Step 1: Write the test for region** at `db/tests/04_core_region.sql`

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('core', 'region', 'core.region table exists');
SELECT has_pk('core', 'region', 'core.region has a primary key');
SELECT col_not_null('core', 'region', 'code', 'code is NOT NULL');
SELECT col_not_null('core', 'region', 'name', 'name is NOT NULL');
SELECT col_not_null('core', 'region', 'type', 'type is NOT NULL');
SELECT col_is_unique('core', 'region', ARRAY['code'], 'code is unique');

INSERT INTO core.region (code, name, type) VALUES ('NCR', 'National Capital Region', 'LOCAL_CLUSTER');
SELECT pass('insert succeeds');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write the test for branch** at `db/tests/05_core_branch.sql`

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('core', 'branch', 'core.branch table exists');
SELECT has_pk('core', 'branch', 'core.branch has a primary key');
SELECT col_is_unique('core', 'branch', ARRAY['code'], 'branch.code is unique');
SELECT col_not_null('core', 'branch', 'name', 'name is NOT NULL');
SELECT col_not_null('core', 'branch', 'region_id', 'region_id is NOT NULL');
SELECT has_fk('core', 'branch', 'branch has FK on region_id');

INSERT INTO core.region (code, name, type) VALUES ('TEST', 'Test Region', 'LOCAL_CLUSTER');
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone, status)
  VALUES ('MNL-HQ', 'Manila HQ', (SELECT region_id FROM core.region WHERE code='TEST'),
          'LOCAL', 'PH', 'Asia/Manila', 'ACTIVE');
SELECT pass('insert succeeds');

PREPARE bad_status AS
  INSERT INTO core.branch (code, name, region_id, type, country_code, timezone, status)
    VALUES ('XXX', 'X', (SELECT region_id FROM core.region WHERE code='TEST'),
            'LOCAL', 'PH', 'Asia/Manila', 'BOGUS');
SELECT throws_ok('bad_status', '23514', NULL, 'invalid status rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

```bash
./tests/run_tests.sh
```

Expected: `04_core_region.sql` and `05_core_branch.sql` fail (tables don't exist).

- [ ] **Step 4: Write `db/migrations/V005__core_region.sql`**

```sql
CREATE TYPE core.region_type AS ENUM ('LOCAL_CLUSTER', 'INTERNATIONAL_COUNTRY');

CREATE TABLE core.region (
  region_id        BIGSERIAL PRIMARY KEY,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             core.region_type NOT NULL,
  parent_region_id BIGINT REFERENCES core.region(region_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT region_code_unique UNIQUE (code)
);

CREATE INDEX idx_region_parent ON core.region(parent_region_id);

CREATE TRIGGER trg_region_updated_at
  BEFORE UPDATE ON core.region
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.region IS 'Local clusters (NCR, REGION-3...) and international countries.';
```

- [ ] **Step 5: Write `db/migrations/V006__core_branch.sql`**

```sql
CREATE TYPE core.branch_type AS ENUM ('LOCAL', 'INTERNATIONAL');
CREATE TYPE core.branch_status AS ENUM ('ACTIVE', 'PLANTING', 'CLOSED');

CREATE TABLE core.branch (
  branch_id          BIGSERIAL PRIMARY KEY,
  code               TEXT NOT NULL,
  name               TEXT NOT NULL,
  region_id          BIGINT NOT NULL REFERENCES core.region(region_id),
  type               core.branch_type NOT NULL,
  country_code       CHAR(2) NOT NULL,
  timezone           TEXT NOT NULL,
  primary_address_id BIGINT,  -- FK added once core.address exists (Task 4)
  launched_on        DATE,
  status             core.branch_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branch_code_unique UNIQUE (code)
);

CREATE INDEX idx_branch_region ON core.branch(region_id);
CREATE INDEX idx_branch_status ON core.branch(status);

CREATE TRIGGER trg_branch_updated_at
  BEFORE UPDATE ON core.branch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.branch IS 'Every JLY church location. The universal tenant key.';
COMMENT ON COLUMN core.branch.primary_address_id IS 'FK to core.address; constraint added by V007.';
```

- [ ] **Step 6: Apply migrations and re-run tests**

```bash
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: `04_core_region.sql` and `05_core_branch.sql` pass.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V005__core_region.sql db/migrations/V006__core_branch.sql \
        db/tests/04_core_region.sql db/tests/05_core_branch.sql
git commit -m "feat(db): add core.region and core.branch with type/status enums"
```

---

## Task 4: `core.address` and `core.person`

**Files:**
- Create: `db/migrations/V007__core_address.sql`
- Create: `db/migrations/V008__core_person.sql`
- Create: `db/tests/06_core_address.sql`
- Create: `db/tests/07_core_person.sql`

- [ ] **Step 1: Write `db/tests/06_core_address.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('core', 'address', 'core.address exists');
SELECT has_pk('core', 'address', 'core.address has a PK');
SELECT col_not_null('core', 'address', 'country_code', 'country_code is NOT NULL');
SELECT has_fk('core', 'branch', 'core.branch has FK on primary_address_id (added in V007)');

INSERT INTO core.address (line1, city, country_code) VALUES ('123 Main St', 'Manila', 'PH');
SELECT pass('insert succeeds');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/07_core_person.sql`**

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('core', 'person', 'core.person exists');
SELECT has_pk('core', 'person', 'PK exists');
SELECT col_not_null('core', 'person', 'first_name', 'first_name NOT NULL');
SELECT col_not_null('core', 'person', 'last_name', 'last_name NOT NULL');
SELECT col_has_default('core', 'person', 'created_at', 'created_at has default');
SELECT col_is_null('core', 'person', 'deleted_at', 'deleted_at is nullable');

INSERT INTO core.person (first_name, last_name, gender)
  VALUES ('Juan', 'Dela Cruz', 'MALE');
SELECT pass('insert succeeds');

UPDATE core.person SET preferred_name = 'JD' WHERE first_name = 'Juan';
SELECT cmp_ok(
  (SELECT updated_at FROM core.person WHERE first_name = 'Juan'),
  '>',
  (SELECT created_at FROM core.person WHERE first_name = 'Juan'),
  'updated_at trigger fires on UPDATE'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests to verify failure**

```bash
./tests/run_tests.sh
```

- [ ] **Step 4: Write `db/migrations/V007__core_address.sql`**

```sql
CREATE TABLE core.address (
  address_id   BIGSERIAL PRIMARY KEY,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT,
  province     TEXT,
  postal_code  TEXT,
  country_code CHAR(2) NOT NULL,
  geom         POINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_address_updated_at
  BEFORE UPDATE ON core.address
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Now wire core.branch.primary_address_id to core.address (forward reference from V006).
ALTER TABLE core.branch
  ADD CONSTRAINT branch_primary_address_fk
  FOREIGN KEY (primary_address_id) REFERENCES core.address(address_id);

CREATE INDEX idx_branch_primary_address ON core.branch(primary_address_id);

COMMENT ON TABLE core.address IS 'Reusable physical addresses; linked from persons, households, branches.';
```

- [ ] **Step 5: Write `db/migrations/V008__core_person.sql`**

```sql
CREATE TYPE core.gender AS ENUM ('MALE', 'FEMALE', 'UNDISCLOSED');
CREATE TYPE core.marital_status AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'DIVORCED');

CREATE TABLE core.person (
  person_id         BIGSERIAL PRIMARY KEY,
  first_name        TEXT NOT NULL,
  middle_name       TEXT,
  last_name         TEXT NOT NULL,
  suffix            TEXT,
  preferred_name    TEXT,
  date_of_birth     DATE,
  gender            core.gender,
  marital_status    core.marital_status,
  nationality       TEXT,
  profile_photo_url TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_person_last_first ON core.person (last_name, first_name);
CREATE INDEX idx_person_dob ON core.person (date_of_birth);
CREATE INDEX idx_person_active ON core.person (person_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_person_name_trgm ON core.person USING GIN (
  (lower(first_name || ' ' || last_name)) gin_trgm_ops
);

CREATE TRIGGER trg_person_updated_at
  BEFORE UPDATE ON core.person
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.person IS 'Every individual: members, FTVs, students, BAC participants. Person can exist without a member record.';
COMMENT ON COLUMN core.person.deleted_at IS 'Soft delete timestamp; NULL = active.';
```

- [ ] **Step 6: Apply and re-run tests**

```bash
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: tests 06 and 07 pass.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V007__core_address.sql db/migrations/V008__core_person.sql \
        db/tests/06_core_address.sql db/tests/07_core_person.sql
git commit -m "feat(db): add core.address and core.person with PII columns and soft delete"
```

---

## Task 5: `core.contact_info` and `core.person_address`

**Files:**
- Create: `db/migrations/V009__core_contact_info.sql`
- Create: `db/migrations/V010__core_person_address.sql`
- Create: `db/tests/08_core_contact_info.sql`
- Create: `db/tests/09_core_person_address.sql`

- [ ] **Step 1: Write `db/tests/08_core_contact_info.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('core', 'contact_info', 'core.contact_info exists');
SELECT has_fk('core', 'contact_info', 'FK to person');
SELECT col_not_null('core', 'contact_info', 'value', 'value NOT NULL');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'B') RETURNING person_id \gset
INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'EMAIL', 'a@b.com', true);
SELECT pass('email insert');

INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'MOBILE', '+639171234567', true);
SELECT pass('mobile insert');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/09_core_person_address.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('core', 'person_address', 'core.person_address exists');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'B') RETURNING person_id \gset
INSERT INTO core.address (line1, country_code) VALUES ('123 Test', 'PH') RETURNING address_id \gset

INSERT INTO core.person_address (person_id, address_id, type, valid_from)
  VALUES (:person_id, :address_id, 'HOME', CURRENT_DATE);
SELECT pass('insert succeeds');

-- NOTE: Use inline throws_ok($$ ... $$, ...) form — Postgres parses enum
-- literals at PREPARE time, so a PREPARE'd named statement with a bogus enum
-- value errors before throws_ok runs. (See Task 3 / test 05 for the same fix.)
SELECT throws_ok(
  format($$INSERT INTO core.person_address (person_id, address_id, type, valid_from)
             VALUES (%L, %L, 'BOGUS', CURRENT_DATE)$$, :'person_id', :'address_id'),
  '22P02',
  NULL,
  'invalid type rejected'
);

SELECT col_not_null('core', 'person_address', 'valid_from', 'valid_from NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V009__core_contact_info.sql`**

```sql
CREATE TYPE core.contact_type AS ENUM ('MOBILE', 'EMAIL', 'LANDLINE', 'MESSENGER', 'OTHER');

CREATE TABLE core.contact_info (
  contact_id    BIGSERIAL PRIMARY KEY,
  person_id     BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  type          core.contact_type NOT NULL,
  value         TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  consented_at  TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_info_person ON core.contact_info(person_id);
CREATE INDEX idx_contact_info_type ON core.contact_info(type);
CREATE UNIQUE INDEX idx_contact_info_one_primary
  ON core.contact_info(person_id, type)
  WHERE is_primary = true;

COMMENT ON TABLE core.contact_info IS 'PII: phone, email, etc. Multiple per person; at most one primary per type.';
```

- [ ] **Step 5: Write `db/migrations/V010__core_person_address.sql`**

```sql
CREATE TYPE core.address_type AS ENUM ('HOME', 'WORK', 'MAILING');

CREATE TABLE core.person_address (
  person_id   BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  address_id  BIGINT NOT NULL REFERENCES core.address(address_id),
  type        core.address_type NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, address_id, valid_from)
);

CREATE INDEX idx_person_address_person ON core.person_address(person_id);
CREATE INDEX idx_person_address_address ON core.person_address(address_id);
CREATE INDEX idx_person_address_current
  ON core.person_address(person_id) WHERE valid_to IS NULL;

COMMENT ON TABLE core.person_address IS 'PII: person ↔ address with type and validity range. Address history retained.';
```

- [ ] **Step 6: Apply and re-run**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh
```

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V009__core_contact_info.sql db/migrations/V010__core_person_address.sql \
        db/tests/08_core_contact_info.sql db/tests/09_core_person_address.sql
git commit -m "feat(db): add core.contact_info and core.person_address with validity ranges"
```

---

## Task 6: `core.household` and `core.household_member`

**Files:**
- Create: `db/migrations/V011__core_household.sql`
- Create: `db/migrations/V012__core_household_member.sql`
- Create: `db/tests/10_core_household.sql`
- Create: `db/tests/11_core_household_member.sql`

- [ ] **Step 1: Write `db/tests/10_core_household.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('core', 'household', 'core.household exists');
SELECT has_fk('core', 'household', 'FK to branch');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Head', 'X') RETURNING person_id \gset

INSERT INTO core.household (branch_id, name, head_of_household_id)
  VALUES (:branch_id, 'The X Family', :person_id);
SELECT pass('household insert succeeds');

SELECT col_not_null('core', 'household', 'name', 'name NOT NULL');
SELECT col_not_null('core', 'household', 'branch_id', 'branch_id NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/11_core_household_member.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('core', 'household_member', 'core.household_member exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Head', 'X') RETURNING person_id \gset
INSERT INTO core.household (branch_id, name) VALUES (:branch_id, 'X Family') RETURNING household_id \gset

INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :person_id, 'HEAD', now());
SELECT pass('insert succeeds');

PREPARE dup AS
  INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :person_id, 'HEAD', now());
SELECT throws_ok('dup', '23505', NULL, 'duplicate (household, person, joined_at) rejected');

SELECT col_not_null('core', 'household_member', 'role_in_household', 'role NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V011__core_household.sql`**

```sql
CREATE TABLE core.household (
  household_id          BIGSERIAL PRIMARY KEY,
  branch_id             BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                  TEXT NOT NULL,
  primary_address_id    BIGINT REFERENCES core.address(address_id),
  head_of_household_id  BIGINT REFERENCES core.person(person_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_household_branch ON core.household(branch_id);
CREATE INDEX idx_household_head ON core.household(head_of_household_id);
CREATE INDEX idx_household_address ON core.household(primary_address_id);
CREATE INDEX idx_household_active ON core.household(household_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_household_updated_at
  BEFORE UPDATE ON core.household
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.household IS 'Operational family unit (e.g., "The Cruz Family").';
```

- [ ] **Step 5: Write `db/migrations/V012__core_household_member.sql`**

```sql
CREATE TYPE core.household_role AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'OTHER');

CREATE TABLE core.household_member (
  household_id      BIGINT NOT NULL REFERENCES core.household(household_id) ON DELETE CASCADE,
  person_id         BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  role_in_household core.household_role NOT NULL,
  joined_at         TIMESTAMPTZ NOT NULL,
  left_at           TIMESTAMPTZ,
  PRIMARY KEY (household_id, person_id, joined_at)
);

CREATE INDEX idx_household_member_person ON core.household_member(person_id);
CREATE INDEX idx_household_member_active
  ON core.household_member(household_id) WHERE left_at IS NULL;

COMMENT ON TABLE core.household_member IS 'Person ↔ household with role and history.';
```

- [ ] **Step 6: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V011__core_household.sql db/migrations/V012__core_household_member.sql \
        db/tests/10_core_household.sql db/tests/11_core_household_member.sql
git commit -m "feat(db): add core.household and core.household_member with role and validity"
```

---

## Task 7: `core.kinship` + bidirectional view

**Files:**
- Create: `db/migrations/V013__core_kinship.sql`
- Create: `db/migrations/V014__core_kinship_bidirectional_view.sql`
- Create: `db/tests/12_core_kinship.sql`
- Create: `db/tests/13_core_kinship_view.sql`

- [ ] **Step 1: Write `db/tests/12_core_kinship.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('core', 'kinship', 'core.kinship exists');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset a_id
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'X') RETURNING person_id \gset b_id

INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:a_id, :b_id, 'SPOUSE', CURRENT_DATE);
SELECT pass('spouse link inserted');

PREPARE self_link AS
  INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:a_id, :a_id, 'SPOUSE', CURRENT_DATE);
SELECT throws_ok('self_link', '23514', NULL, 'self-kinship rejected by check constraint');

SELECT col_not_null('core', 'kinship', 'relationship', 'relationship NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/13_core_kinship_view.sql`**

```sql
BEGIN;
SELECT plan(3);

SELECT has_view('core', 'kinship_bidirectional', 'view exists');

INSERT INTO core.person (first_name, last_name) VALUES ('Parent', 'X') RETURNING person_id \gset p_id
INSERT INTO core.person (first_name, last_name) VALUES ('Child', 'X') RETURNING person_id \gset c_id

INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:p_id, :c_id, 'PARENT_OF', CURRENT_DATE);

-- Forward direction
SELECT is(
  (SELECT relationship::text FROM core.kinship_bidirectional
    WHERE person_id = :p_id AND related_person_id = :c_id),
  'PARENT_OF',
  'forward direction visible in view'
);

-- Inverse direction (should appear as CHILD_OF for the child)
SELECT is(
  (SELECT relationship::text FROM core.kinship_bidirectional
    WHERE person_id = :c_id AND related_person_id = :p_id),
  'CHILD_OF',
  'PARENT_OF flipped to CHILD_OF in view'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V013__core_kinship.sql`**

```sql
CREATE TYPE core.kinship_type AS ENUM ('SPOUSE', 'PARENT_OF', 'CHILD_OF', 'SIBLING', 'OTHER');

CREATE TABLE core.kinship (
  kinship_id        BIGSERIAL PRIMARY KEY,
  person_id         BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  related_person_id BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  relationship      core.kinship_type NOT NULL,
  valid_from        DATE NOT NULL,
  valid_to          DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kinship_no_self CHECK (person_id <> related_person_id)
);

CREATE INDEX idx_kinship_person ON core.kinship(person_id);
CREATE INDEX idx_kinship_related ON core.kinship(related_person_id);
CREATE INDEX idx_kinship_active ON core.kinship(person_id) WHERE valid_to IS NULL;

COMMENT ON TABLE core.kinship IS 'Spouse / parent / sibling graph. Stored one direction per relationship; query via core.kinship_bidirectional.';
```

- [ ] **Step 5: Write `db/migrations/V014__core_kinship_bidirectional_view.sql`**

```sql
CREATE VIEW core.kinship_bidirectional AS
SELECT
  kinship_id,
  person_id,
  related_person_id,
  relationship,
  valid_from,
  valid_to,
  notes,
  'FORWARD' AS direction
FROM core.kinship
UNION ALL
SELECT
  kinship_id,
  related_person_id  AS person_id,
  person_id          AS related_person_id,
  CASE relationship
    WHEN 'PARENT_OF' THEN 'CHILD_OF'::core.kinship_type
    WHEN 'CHILD_OF'  THEN 'PARENT_OF'::core.kinship_type
    ELSE relationship  -- SPOUSE, SIBLING, OTHER are symmetric
  END AS relationship,
  valid_from,
  valid_to,
  notes,
  'INVERSE' AS direction
FROM core.kinship;

COMMENT ON VIEW core.kinship_bidirectional IS 'Materializes both directions of each kinship row; PARENT_OF/CHILD_OF flipped, SPOUSE/SIBLING/OTHER symmetric.';
```

- [ ] **Step 6: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V013__core_kinship.sql db/migrations/V014__core_kinship_bidirectional_view.sql \
        db/tests/12_core_kinship.sql db/tests/13_core_kinship_view.sql
git commit -m "feat(db): add core.kinship and bidirectional view (auto-flips PARENT_OF↔CHILD_OF)"
```

---

## Task 8: `membership.lifecycle_stage` and `membership.role` (lookups + seeds)

**Files:**
- Create: `db/migrations/V015__membership_lifecycle_stage.sql`
- Create: `db/migrations/V016__membership_role.sql`
- Create: `db/migrations/R__seed_lifecycle_stages.sql`
- Create: `db/migrations/R__seed_roles.sql`
- Create: `db/tests/14_membership_lifecycle_stage.sql`
- Create: `db/tests/15_membership_role.sql`

- [ ] **Step 1: Write `db/tests/14_membership_lifecycle_stage.sql`**

```sql
BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'lifecycle_stage', 'lifecycle_stage exists');
SELECT col_is_pk('membership', 'lifecycle_stage', 'stage_code', 'stage_code is PK');

-- Confirm seeds
SELECT bag_eq(
  $$SELECT stage_code FROM membership.lifecycle_stage WHERE is_active$$,
  $$VALUES ('FTV'),('DFL'),('OGV'),('RA'),('REGULAR_MEMBER')$$,
  'all 5 lifecycle stages seeded'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/15_membership_role.sql`**

```sql
BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'role', 'role exists');

-- Confirm Lead Taker is NOT in roles (it's a Network)
SELECT is_empty(
  $$SELECT 1 FROM membership.role WHERE code = 'LEAD_TAKER'$$,
  'LEAD_TAKER correctly absent from roles'
);

SELECT bag_has(
  $$SELECT code FROM membership.role WHERE is_active$$,
  $$VALUES ('PASTOR'),('REGIONAL_DIRECTOR'),('ADMIN_STAFF'),('PCM')$$,
  'core roles present'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V015__membership_lifecycle_stage.sql`**

```sql
CREATE TABLE membership.lifecycle_stage (
  stage_code  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership.lifecycle_stage IS 'Lookup of member lifecycle stages. FTV→DFL/OGV/RA→REGULAR_MEMBER journey.';
```

- [ ] **Step 5: Write `db/migrations/V016__membership_role.sql`**

```sql
CREATE TABLE membership.role (
  role_id     BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_pastoral BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership.role IS 'Lookup of stackable roles a member can hold. Lead Taker is NOT here — it is a Network in the ministries schema.';
```

- [ ] **Step 6: Write `db/migrations/R__seed_lifecycle_stages.sql`**

```sql
INSERT INTO membership.lifecycle_stage (stage_code, name, description, order_index, is_terminal) VALUES
  ('FTV',            'First Time Visitor',  'Someone who has attended at least once.', 10, false),
  ('OGV',            'Ongoing Visitor',     'Visits intermittently but not weekly.',   20, false),
  ('RA',             'Regular Attendee',    'Attends regularly; not yet a member.',    30, false),
  ('REGULAR_MEMBER', 'Regular Member',      'Has met membership criteria.',            40, false),
  ('DFL',            'Drop From List',      'Not interested or no longer pursued.',    99, true)
ON CONFLICT (stage_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  is_terminal = EXCLUDED.is_terminal;
```

- [ ] **Step 7: Write `db/migrations/R__seed_roles.sql`**

```sql
INSERT INTO membership.role (code, name, description, is_pastoral) VALUES
  ('PASTOR',            'Pastor',                'Pastoral leadership.',                       true),
  ('REGIONAL_DIRECTOR', 'Regional Director',     'Oversees a region cluster.',                 true),
  ('ADMIN_STAFF',       'Admin Staff',           'Administrative role.',                       false),
  ('PCM',               'Pastoral Care Ministry','Provides pastoral care to assigned members.',true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_pastoral = EXCLUDED.is_pastoral;
```

- [ ] **Step 8: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V015__membership_lifecycle_stage.sql \
        db/migrations/V016__membership_role.sql \
        db/migrations/R__seed_lifecycle_stages.sql \
        db/migrations/R__seed_roles.sql \
        db/tests/14_membership_lifecycle_stage.sql \
        db/tests/15_membership_role.sql
git commit -m "feat(db): add membership lookup tables (lifecycle_stage, role) with seed data"
```

---

## Task 9: `membership.member` (current state only — history tables come in Task 10)

**Files:**
- Create: `db/migrations/V017__membership_member.sql`
- Create: `db/tests/16_membership_member.sql`

- [ ] **Step 1: Write `db/tests/16_membership_member.sql`**

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('membership', 'member', 'member table exists');
SELECT has_pk('membership', 'member', 'PK exists');
SELECT col_is_unique('membership', 'member', ARRAY['person_id'], 'one member per person');
SELECT col_is_unique('membership', 'member', ARRAY['member_code'], 'member_code unique');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL', 'Manila', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at, status)
  VALUES (:person_id, :branch_id, 'MNL-2026-000001', 'FTV', now(), 'ACTIVE');
SELECT pass('member insert succeeds');

PREPARE bad_stage AS
  INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at, status)
  VALUES (:person_id, :branch_id, 'X', 'BOGUS', now(), 'ACTIVE');
SELECT throws_ok('bad_stage', '23503', NULL, 'invalid stage rejected via FK');

SELECT col_not_null('membership', 'member', 'joined_at', 'joined_at NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test, verify failure**

- [ ] **Step 3: Write `db/migrations/V017__membership_member.sql`**

```sql
CREATE TYPE membership.member_status AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DECEASED');

CREATE TABLE membership.member (
  member_id              BIGSERIAL PRIMARY KEY,
  person_id              BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  member_code            TEXT NOT NULL UNIQUE,
  current_stage          TEXT NOT NULL REFERENCES membership.lifecycle_stage(stage_code),
  joined_at              TIMESTAMPTZ NOT NULL,
  regular_member_since   TIMESTAMPTZ,
  status                 membership.member_status NOT NULL DEFAULT 'ACTIVE',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_member_branch_stage ON membership.member(branch_id, current_stage);
CREATE INDEX idx_member_status ON membership.member(status);
CREATE INDEX idx_member_active ON membership.member(member_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_member_updated_at
  BEFORE UPDATE ON membership.member
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE membership.member IS 'A person who is known to the church at any lifecycle stage. branch_id is current home branch (denormalized for query speed); transfers tracked in branch_membership_history.';
```

- [ ] **Step 4: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V017__membership_member.sql db/tests/16_membership_member.sql
git commit -m "feat(db): add membership.member with FK to lifecycle_stage and updated_at trigger"
```

---

## Task 10: History tables and triggers (lifecycle stage + branch transfer)

**Files:**
- Create: `db/migrations/V018__membership_lifecycle_stage_history.sql`
- Create: `db/migrations/V019__membership_branch_membership_history.sql`
- Create: `db/tests/17_membership_history_tables.sql`
- Create: `db/tests/18_membership_history_triggers.sql`

- [ ] **Step 1: Write `db/tests/17_membership_history_tables.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('membership', 'lifecycle_stage_history', 'history table exists');
SELECT has_table('membership', 'branch_membership_history', 'branch transfer history exists');
SELECT has_fk('membership', 'lifecycle_stage_history', 'FK to member');
SELECT has_fk('membership', 'branch_membership_history', 'FK to member');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/18_membership_history_triggers.sql`**

```sql
BEGIN;
SELECT plan(4);

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL', 'Manila', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset mnl_id
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('CEB', 'Cebu',   :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset ceb_id
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :mnl_id, 'MNL-2026-1', 'FTV', now()) RETURNING member_id \gset

-- Trigger lifecycle change
UPDATE membership.member SET current_stage = 'OGV' WHERE member_id = :member_id;
SELECT is(
  (SELECT count(*)::int FROM membership.lifecycle_stage_history WHERE member_id = :member_id),
  1,
  'lifecycle history row inserted on stage change'
);
SELECT is(
  (SELECT to_stage FROM membership.lifecycle_stage_history WHERE member_id = :member_id),
  'OGV',
  'history records new stage'
);

-- Trigger branch transfer
UPDATE membership.member SET branch_id = :ceb_id WHERE member_id = :member_id;
SELECT is(
  (SELECT count(*)::int FROM membership.branch_membership_history WHERE member_id = :member_id),
  1,
  'branch history row inserted on transfer'
);
SELECT is(
  (SELECT to_branch_id FROM membership.branch_membership_history WHERE member_id = :member_id),
  :ceb_id,
  'history records new branch'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V018__membership_lifecycle_stage_history.sql`**

```sql
CREATE TABLE membership.lifecycle_stage_history (
  history_id           BIGSERIAL PRIMARY KEY,
  member_id            BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  from_stage           TEXT REFERENCES membership.lifecycle_stage(stage_code),
  to_stage             TEXT NOT NULL REFERENCES membership.lifecycle_stage(stage_code),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from       DATE,
  changed_by_person_id BIGINT REFERENCES core.person(person_id),
  reason               TEXT
);

CREATE INDEX idx_lifecycle_history_member ON membership.lifecycle_stage_history(member_id, changed_at DESC);

-- Wire the generic record_history trigger to fire on stage changes.
CREATE TRIGGER trg_member_lifecycle_history
  AFTER UPDATE OF current_stage ON membership.member
  FOR EACH ROW
  EXECUTE FUNCTION public.record_history(
    'membership.lifecycle_stage_history',
    'member_id',
    'current_stage:from_stage:to_stage'
  );

COMMENT ON TABLE membership.lifecycle_stage_history IS 'Every change to member.current_stage. Auto-populated by trigger.';
```

- [ ] **Step 5: Write `db/migrations/V019__membership_branch_membership_history.sql`**

```sql
CREATE TABLE membership.branch_membership_history (
  history_id           BIGSERIAL PRIMARY KEY,
  member_id            BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  from_branch_id       BIGINT REFERENCES core.branch(branch_id),
  to_branch_id         BIGINT NOT NULL REFERENCES core.branch(branch_id),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from       DATE,
  changed_by_person_id BIGINT REFERENCES core.person(person_id),
  reason               TEXT
);

CREATE INDEX idx_branch_history_member ON membership.branch_membership_history(member_id, changed_at DESC);

CREATE TRIGGER trg_member_branch_history
  AFTER UPDATE OF branch_id ON membership.member
  FOR EACH ROW
  EXECUTE FUNCTION public.record_history(
    'membership.branch_membership_history',
    'member_id',
    'branch_id:from_branch_id:to_branch_id'
  );

COMMENT ON TABLE membership.branch_membership_history IS 'Every change to member.branch_id (branch transfer). Auto-populated by trigger.';
```

- [ ] **Step 6: Apply and test**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh
```

If trigger tests fail with column-resolution errors (the generic `record_history` function uses `format`/`EXECUTE` patterns which can be brittle): debug by manually running the UPDATE in psql and inspecting the history table. The generic function may need a per-table specialization. If so, replace the generic call with table-specific PL/pgSQL functions (`record_lifecycle_history()` and `record_branch_history()`), each calling `INSERT INTO ... SELECT NEW.member_id, OLD.current_stage, NEW.current_stage, now()` directly.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V018__membership_lifecycle_stage_history.sql \
        db/migrations/V019__membership_branch_membership_history.sql \
        db/tests/17_membership_history_tables.sql \
        db/tests/18_membership_history_triggers.sql
git commit -m "feat(db): track lifecycle stage transitions and branch transfers via triggers"
```

---

## Task 11: `member_role`, `regular_member_application`, `pastoral_care_assignment`

**Files:**
- Create: `db/migrations/V020__membership_member_role.sql`
- Create: `db/migrations/V021__membership_regular_member_application.sql`
- Create: `db/migrations/V022__membership_pastoral_care_assignment.sql`
- Create: `db/tests/19_membership_member_role.sql`
- Create: `db/tests/20_membership_application_pcm.sql`

- [ ] **Step 1: Write `db/tests/19_membership_member_role.sql`**

```sql
BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'member_role', 'member_role exists');

INSERT INTO core.region (code, name, type) VALUES ('R','R','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B','B',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A','X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-26-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :member_id, role_id, :branch_id, now() FROM membership.role WHERE code='PASTOR';
SELECT pass('member_role insert');

INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :member_id, role_id, :branch_id, now() FROM membership.role WHERE code='ADMIN_STAFF';
SELECT pass('stacking second role works');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write `db/tests/20_membership_application_pcm.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('membership', 'regular_member_application', 'application table exists');
SELECT has_table('membership', 'pastoral_care_assignment', 'pcm table exists');

INSERT INTO core.region (code, name, type) VALUES ('R','R','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B','B',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Carer','X') RETURNING person_id \gset c_id
INSERT INTO core.person (first_name, last_name) VALUES ('Cared','X') RETURNING person_id \gset cared_id
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:c_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset carer_member_id
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:cared_id, :branch_id, 'B-2', 'OGV', now()) RETURNING member_id \gset cared_member_id

INSERT INTO membership.regular_member_application (member_id, status, criteria_checklist)
  VALUES (:cared_member_id, 'PENDING', '{"attended_4_services":true,"heartlink_completed":false}'::jsonb);
SELECT pass('application insert with JSONB checklist');

INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:carer_member_id, :cared_member_id, now());
SELECT pass('pcm assignment insert');

PREPARE dup_active AS
  INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:carer_member_id, :cared_member_id, now());
SELECT throws_ok('dup_active', '23505', NULL, 'second active PCM assignment for same person rejected');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests, verify failure**

- [ ] **Step 4: Write `db/migrations/V020__membership_member_role.sql`**

```sql
CREATE TABLE membership.member_role (
  member_role_id        BIGSERIAL PRIMARY KEY,
  member_id             BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  role_id               BIGINT NOT NULL REFERENCES membership.role(role_id),
  branch_id             BIGINT REFERENCES core.branch(branch_id),
  region_id             BIGINT REFERENCES core.region(region_id),
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ,
  assigned_by_person_id BIGINT REFERENCES core.person(person_id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_role_ended_after_assigned CHECK (ended_at IS NULL OR ended_at > assigned_at)
);

CREATE INDEX idx_member_role_member ON membership.member_role(member_id);
CREATE INDEX idx_member_role_role ON membership.member_role(role_id);
CREATE INDEX idx_member_role_active
  ON membership.member_role(member_id) WHERE ended_at IS NULL;
CREATE INDEX idx_member_role_branch ON membership.member_role(branch_id);
CREATE INDEX idx_member_role_region ON membership.member_role(region_id);

COMMENT ON TABLE membership.member_role IS 'Stackable role assignments. branch_id/region_id scope where applicable (e.g., Regional Director).';
```

- [ ] **Step 5: Write `db/migrations/V021__membership_regular_member_application.sql`**

```sql
CREATE TYPE membership.application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE membership.regular_member_application (
  application_id          BIGSERIAL PRIMARY KEY,
  member_id               BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  reviewed_by_person_id   BIGINT REFERENCES core.person(person_id),
  status                  membership.application_status NOT NULL DEFAULT 'PENDING',
  criteria_checklist      JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_notes          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_member ON membership.regular_member_application(member_id);
CREATE INDEX idx_application_status ON membership.regular_member_application(status);
CREATE UNIQUE INDEX idx_application_one_pending
  ON membership.regular_member_application(member_id)
  WHERE status = 'PENDING';

CREATE TRIGGER trg_application_updated_at
  BEFORE UPDATE ON membership.regular_member_application
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE membership.regular_member_application IS 'Application to advance to Regular Member. criteria_checklist JSONB is intentionally schema-less so criteria can evolve without migrations.';
```

- [ ] **Step 6: Write `db/migrations/V022__membership_pastoral_care_assignment.sql`**

```sql
CREATE TYPE membership.pcm_status AS ENUM ('ACTIVE', 'ENDED', 'REASSIGNED');

CREATE TABLE membership.pastoral_care_assignment (
  assignment_id      BIGSERIAL PRIMARY KEY,
  carer_member_id    BIGINT NOT NULL REFERENCES membership.member(member_id),
  assigned_member_id BIGINT NOT NULL REFERENCES membership.member(member_id),
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  status             membership.pcm_status NOT NULL DEFAULT 'ACTIVE',
  notes              TEXT,
  CONSTRAINT pcm_no_self CHECK (carer_member_id <> assigned_member_id)
);

CREATE INDEX idx_pcm_carer ON membership.pastoral_care_assignment(carer_member_id);
CREATE INDEX idx_pcm_assigned ON membership.pastoral_care_assignment(assigned_member_id);
CREATE UNIQUE INDEX idx_pcm_one_active_per_assigned
  ON membership.pastoral_care_assignment(assigned_member_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE membership.pastoral_care_assignment IS 'PCM ↔ cared-for member. Partial unique index enforces at most one active PCM per member.';
```

- [ ] **Step 7: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V020__membership_member_role.sql \
        db/migrations/V021__membership_regular_member_application.sql \
        db/migrations/V022__membership_pastoral_care_assignment.sql \
        db/tests/19_membership_member_role.sql \
        db/tests/20_membership_application_pcm.sql
git commit -m "feat(db): add member_role, regular_member_application, pastoral_care_assignment"
```

---

## Task 12: Soft-delete `_active` views

**Files:**
- Create: `db/migrations/V023__core_active_views.sql`
- Create: `db/migrations/V024__membership_active_views.sql`
- Create: `db/tests/21_active_views.sql`

- [ ] **Step 1: Write `db/tests/21_active_views.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT has_view('core', 'person_active', 'core.person_active view exists');
SELECT has_view('core', 'household_active', 'core.household_active view exists');
SELECT has_view('membership', 'member_active', 'membership.member_active view exists');

INSERT INTO core.person (first_name, last_name) VALUES ('Live', 'X') RETURNING person_id \gset live_id
INSERT INTO core.person (first_name, last_name, deleted_at) VALUES ('Dead', 'Y', now()) RETURNING person_id \gset dead_id

SELECT bag_eq(
  $$SELECT person_id FROM core.person_active WHERE last_name IN ('X','Y')$$,
  format($$VALUES (%L::bigint)$$, :live_id),
  'person_active excludes soft-deleted rows'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test, verify failure**

- [ ] **Step 3: Write `db/migrations/V023__core_active_views.sql`**

```sql
CREATE VIEW core.person_active AS
  SELECT * FROM core.person WHERE deleted_at IS NULL;

CREATE VIEW core.household_active AS
  SELECT * FROM core.household WHERE deleted_at IS NULL;

COMMENT ON VIEW core.person_active IS 'core.person filtered to non-deleted rows. Use this in operational queries.';
COMMENT ON VIEW core.household_active IS 'core.household filtered to non-deleted rows.';
```

- [ ] **Step 4: Write `db/migrations/V024__membership_active_views.sql`**

```sql
CREATE VIEW membership.member_active AS
  SELECT * FROM membership.member WHERE deleted_at IS NULL;

COMMENT ON VIEW membership.member_active IS 'membership.member filtered to non-deleted rows.';
```

- [ ] **Step 5: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V023__core_active_views.sql db/migrations/V024__membership_active_views.sql \
        db/tests/21_active_views.sql
git commit -m "feat(db): add _active views for person, household, member (soft-delete filter)"
```

---

## Task 13: Database roles (`app_general`, `app_pastoral`, `app_full`) and PII column grants

**Files:**
- Create: `db/migrations/V025__db_roles.sql`
- Create: `db/tests/22_db_roles.sql`

- [ ] **Step 1: Write `db/tests/22_db_roles.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_role('app_general', 'app_general role exists');
SELECT has_role('app_pastoral', 'app_pastoral role exists');
SELECT has_role('app_full', 'app_full role exists');

-- app_general should NOT be able to SELECT contact_info
SET LOCAL ROLE app_general;
PREPARE pii_read AS SELECT contact_id FROM core.contact_info LIMIT 1;
SELECT throws_ok('pii_read', '42501', NULL, 'app_general cannot read core.contact_info');
RESET ROLE;

-- app_pastoral CAN read contact_info
SET LOCAL ROLE app_pastoral;
PREPARE pii_read_ok AS SELECT contact_id FROM core.contact_info LIMIT 1;
SELECT lives_ok('pii_read_ok', 'app_pastoral can read core.contact_info');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test, verify failure**

- [ ] **Step 3: Write `db/migrations/V025__db_roles.sql`**

```sql
-- ============================================================================
-- Database roles for application access
-- ============================================================================
-- These are NOLOGIN roles; the actual app DB users (created out-of-band) GRANT
-- one of these. In Cloud SQL, create the connecting user with cloudsql_iam or
-- a password, then GRANT app_general | app_pastoral | app_full TO <user>.

CREATE ROLE app_general NOLOGIN;
CREATE ROLE app_pastoral NOLOGIN;
CREATE ROLE app_full NOLOGIN;

-- ----------------------------------------------------------------------------
-- app_full: full read/write access (used by main backend)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA core, membership TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, membership TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- ----------------------------------------------------------------------------
-- app_pastoral: full read incl. PII
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA core, membership TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT SELECT ON TABLES TO app_pastoral;

-- ----------------------------------------------------------------------------
-- app_general: read access EXCLUDING PII tables and PII columns
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA core, membership TO app_general;

-- Revoke entirely on PII tables
REVOKE SELECT ON core.contact_info FROM app_general;
REVOKE SELECT ON core.address FROM app_general;
REVOKE SELECT ON core.person_address FROM app_general;

-- Column-level: revoke specific PII columns on core.person
REVOKE SELECT (date_of_birth, notes) ON core.person FROM app_general;

-- Apply default privileges so future tables in these schemas are also restricted.
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT SELECT ON TABLES TO app_general;
```

- [ ] **Step 4: Apply, test, commit**

```bash
docker compose run --rm flyway migrate && ./tests/run_tests.sh

git add db/migrations/V025__db_roles.sql db/tests/22_db_roles.sql
git commit -m "feat(db): add app_general/app_pastoral/app_full roles with PII column grants"
```

---

## Task 14: End-to-end smoke test and final verification

**Files:**
- Create: `db/tests/99_smoke_e2e.sql`

- [ ] **Step 1: Write `db/tests/99_smoke_e2e.sql`** (an end-to-end happy path through the foundation)

```sql
BEGIN;
SELECT plan(8);

-- Set up region, branch
INSERT INTO core.region (code, name, type) VALUES ('NCR','National Capital Region','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL-HQ','Manila HQ',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset

-- Create a household with an address
INSERT INTO core.address (line1, city, country_code) VALUES ('1 Faith Ave','Manila','PH') RETURNING address_id \gset

INSERT INTO core.person (first_name, last_name, gender) VALUES ('Juan','Dela Cruz','MALE') RETURNING person_id \gset jdc_id
INSERT INTO core.person (first_name, last_name, gender) VALUES ('Maria','Dela Cruz','FEMALE') RETURNING person_id \gset mdc_id

INSERT INTO core.household (branch_id, name, primary_address_id, head_of_household_id)
  VALUES (:branch_id, 'The Dela Cruz Family', :address_id, :jdc_id) RETURNING household_id \gset

INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :jdc_id, 'HEAD', now());
INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :mdc_id, 'SPOUSE', now());

-- Spouse kinship link
INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:jdc_id, :mdc_id, 'SPOUSE', CURRENT_DATE);

SELECT is(
  (SELECT count(*)::int FROM core.kinship_bidirectional
   WHERE person_id IN (:jdc_id, :mdc_id) AND relationship='SPOUSE'),
  2,
  'spouse appears bidirectionally in kinship view'
);

-- Make Juan an FTV-stage member
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:jdc_id, :branch_id, 'MNL-2026-000001', 'FTV', now()) RETURNING member_id \gset jdc_member

SELECT is(
  (SELECT current_stage FROM membership.member WHERE member_id = :jdc_member),
  'FTV',
  'member starts as FTV'
);

-- Promote through the journey
UPDATE membership.member SET current_stage = 'OGV' WHERE member_id = :jdc_member;
UPDATE membership.member SET current_stage = 'RA'  WHERE member_id = :jdc_member;
UPDATE membership.member SET current_stage = 'REGULAR_MEMBER', regular_member_since = now()
  WHERE member_id = :jdc_member;

SELECT is(
  (SELECT count(*)::int FROM membership.lifecycle_stage_history WHERE member_id = :jdc_member),
  3,
  'three lifecycle transitions recorded'
);

-- Stack roles: PASTOR + ADMIN_STAFF
INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :jdc_member, role_id, :branch_id, now() FROM membership.role WHERE code='PASTOR';
INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :jdc_member, role_id, :branch_id, now() FROM membership.role WHERE code='ADMIN_STAFF';

SELECT is(
  (SELECT count(*)::int FROM membership.member_role
   WHERE member_id = :jdc_member AND ended_at IS NULL),
  2,
  'two roles stacked on the same member'
);

-- PCM assignment: Maria becomes a member and gets assigned to Juan
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:mdc_id, :branch_id, 'MNL-2026-000002', 'OGV', now()) RETURNING member_id \gset mdc_member

INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:jdc_member, :mdc_member, now());

SELECT is(
  (SELECT count(*)::int FROM membership.pastoral_care_assignment
   WHERE assigned_member_id = :mdc_member AND ended_at IS NULL),
  1,
  'PCM assignment active for Maria'
);

-- Soft delete check
UPDATE core.person SET deleted_at = now() WHERE person_id = :mdc_id;
SELECT is(
  (SELECT count(*)::int FROM core.person_active WHERE person_id = :mdc_id),
  0,
  'soft-deleted person hidden from person_active view'
);

-- Branch transfer
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('CEB','Cebu',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset ceb_id
UPDATE membership.member SET branch_id = :ceb_id WHERE member_id = :jdc_member;
SELECT is(
  (SELECT count(*)::int FROM membership.branch_membership_history WHERE member_id = :jdc_member),
  1,
  'branch transfer recorded in history'
);

-- Application with JSONB checklist
INSERT INTO membership.regular_member_application (member_id, status, criteria_checklist)
  VALUES (:jdc_member, 'APPROVED',
          '{"attended_4_services":true,"heartlink_completed":true,"interview_done":true}'::jsonb);
SELECT is(
  (SELECT criteria_checklist->'heartlink_completed' FROM membership.regular_member_application
   WHERE member_id = :jdc_member),
  'true'::jsonb,
  'JSONB criteria_checklist queryable by key'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the full test suite from scratch**

```bash
cd db
docker compose down -v
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: every test file passes (no `not ok` lines).

- [ ] **Step 3: Document state and commit**

Update `db/README.md` to add a "Foundation status" section listing what's implemented and tested. Then commit:

```bash
git add db/tests/99_smoke_e2e.sql db/README.md
git commit -m "test(db): end-to-end smoke test exercising person/member/role/PCM/branch-transfer/JSONB"
git tag plan-1-foundation-complete
```

---

## Self-Review Checklist (run before declaring done)

- [ ] All 14 tasks completed with green tests.
- [ ] `git tag plan-1-foundation-complete` exists.
- [ ] No `TBD`, `TODO`, or placeholder text in any migration or test file.
- [ ] Every FK column has an explicit index.
- [ ] Every mutable table has `created_at`, `updated_at`, and the `set_updated_at` trigger.
- [ ] Every PII-bearing or relationship-bearing table has `deleted_at` and an `_active` view.
- [ ] `R__seed_lifecycle_stages.sql` and `R__seed_roles.sql` are idempotent (use `ON CONFLICT DO UPDATE`).
- [ ] `LEAD_TAKER` is NOT in `membership.role` (verified by test 15).
- [ ] All five lifecycle stages present: FTV, OGV, RA, REGULAR_MEMBER, DFL.
- [ ] PCM partial unique index enforces "one active PCM per member" (verified by test 20).
- [ ] Spouse kinship is bidirectionally visible via `core.kinship_bidirectional`.

---

## What's next (Plans 2-4)

When you're ready:
- **Plan 2 (Operational layer):** `ministries`, `events`, `attendance` (with monthly partitioning, child check-in, event registration).
- **Plan 3 (Specialized domains):** `programs` (Heartlink), `missions` (Scholars + BAC), `education` (BC + ISU).
- **Plan 4 (Migration):** `staging` schema, Python ETL from Google Sheets, FK-respecting promotion, cutover scripts.

Each will be its own plan document.
