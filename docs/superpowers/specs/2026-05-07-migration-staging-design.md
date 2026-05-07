# JLY Church Database — Plan 4: Migration & Staging Design

## Goal

Add the `staging` schema for one-shot Google Sheets migration: import batch tracking, a pattern staging table (`stg_person`), person deduplication tables, and standalone pipeline scripts (cleanse, validate, promote). Includes a minimal Python loader stub.

## Architecture

Single `staging` schema with Flyway-managed tables for infrastructure and dedup. Pipeline scripts (cleanse/validate/promote) live outside Flyway as standalone SQL in `db/staging/`. Python loader stub lives in `etl/`. The staging schema is write-heavy, one-shot operational — not part of the long-lived application schema.

Three phases:

1. **Phase 1: Staging infrastructure** — schema, enums, `import_batch` tracker, `stg_person` pattern table, role grants
2. **Phase 2: Dedup tables** — `dedup_run`, `person_candidate`, `person_merge_review`
3. **Phase 3: Pipeline scripts + Python stub** — standalone SQL for cleanse/validate/promote, minimal Python loader, README

Dependencies: `staging` → `core` (person, branch, address, contact_info) + `membership` (member) for the promote phase. No dependencies on `ministries`, `events`, `attendance`, `programs`, `missions`, or `education`.

## Tech Stack

PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows. Python 3.11+ with psycopg2-binary, gspread, pandas for the loader stub.

---

## Phase 1: Staging Infrastructure

### New Schema

`CREATE SCHEMA IF NOT EXISTS staging;`

### Enums

- `staging.batch_status` — LOADING, LOADED, CLEANSING, CLEANSED, VALIDATING, VALIDATED, PROMOTING, PROMOTED, FAILED
- `staging.row_status` — RAW, CLEANSED, VALID, INVALID, PROMOTED, SKIPPED

### Tables

#### `staging.import_batch`

Import batch tracker. One row per load run.

| Column | Type | Constraints |
|---|---|---|
| `batch_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `source_name` | TEXT | NOT NULL |
| `source_type` | TEXT | NOT NULL DEFAULT 'GOOGLE_SHEET' |
| `row_count` | INT | |
| `status` | staging.batch_status | NOT NULL DEFAULT 'LOADING' |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `completed_at` | TIMESTAMPTZ | |
| `error_message` | TEXT | |
| `metadata` | JSONB | NOT NULL DEFAULT '{}' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_import_batch_status` ON (status)
- Comment: 'Import batch tracker. One row per load run.'

#### `staging.stg_person`

Pattern staging table for person/member data. All source columns are `TEXT`. Future staging tables follow this pattern: `staging_id`, `batch_id`, `source_row_number`, `row_status`, `raw_*` columns, `validation_errors`, `promoted_to_*`, `promoted_at`, `created_at`.

| Column | Type | Constraints |
|---|---|---|
| `staging_id` | BIGSERIAL | PRIMARY KEY |
| `batch_id` | UUID | NOT NULL, FK → import_batch |
| `source_row_number` | INT | |
| `row_status` | staging.row_status | NOT NULL DEFAULT 'RAW' |
| `raw_first_name` | TEXT | |
| `raw_last_name` | TEXT | |
| `raw_middle_name` | TEXT | |
| `raw_suffix` | TEXT | |
| `raw_gender` | TEXT | |
| `raw_birth_date` | TEXT | |
| `raw_email` | TEXT | |
| `raw_phone` | TEXT | |
| `raw_address_line1` | TEXT | |
| `raw_address_line2` | TEXT | |
| `raw_city` | TEXT | |
| `raw_province` | TEXT | |
| `raw_country` | TEXT | |
| `raw_postal_code` | TEXT | |
| `raw_branch_code` | TEXT | |
| `raw_member_code` | TEXT | |
| `raw_member_stage` | TEXT | |
| `raw_joined_date` | TEXT | |
| `raw_roles` | TEXT | |
| `validation_errors` | JSONB | |
| `promoted_to_person_id` | BIGINT | |
| `promoted_to_member_id` | BIGINT | |
| `promoted_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_stg_person_batch` ON (batch_id)
- Index: `idx_stg_person_status` ON (row_status)
- Comment: 'Raw person/member import. All raw_ columns are TEXT. Pattern table for future stg_* tables.'

### Role Grants

```sql
GRANT USAGE ON SCHEMA staging TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA staging TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA staging TO app_full;

GRANT USAGE ON SCHEMA staging TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA staging TO app_pastoral;

GRANT USAGE ON SCHEMA staging TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA staging TO app_general;

ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT SELECT ON TABLES TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT SELECT ON TABLES TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;
```

---

## Phase 2: Dedup Tables

### Enums

- `staging.merge_review_status` — PENDING, MERGED, DISTINCT, SKIPPED

### Tables

#### `staging.dedup_run`

Tracks each deduplication pass.

| Column | Type | Constraints |
|---|---|---|
| `run_id` | BIGSERIAL | PRIMARY KEY |
| `batch_id` | UUID | FK → import_batch |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `completed_at` | TIMESTAMPTZ | |
| `candidates_found` | INT | |
| `auto_merged` | INT | |
| `queued_for_review` | INT | |
| `distinct_persons` | INT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_dedup_run_batch` ON (batch_id)
- Comment: 'Dedup run tracker. Stats on each deduplication pass.'

#### `staging.person_candidate`

Normalized person candidates extracted from staging rows for dedup processing.

| Column | Type | Constraints |
|---|---|---|
| `candidate_id` | BIGSERIAL | PRIMARY KEY |
| `run_id` | BIGINT | NOT NULL, FK → dedup_run |
| `staging_id` | BIGINT | NOT NULL, FK → stg_person |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `phone` | TEXT | |
| `email` | TEXT | |
| `birth_date` | DATE | |
| `blocking_key` | TEXT | |
| `resolved_person_id` | BIGINT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Index: `idx_person_candidate_run` ON (run_id)
- Index: `idx_person_candidate_blocking` ON (blocking_key)
- Comment: 'Normalized person candidates for dedup. blocking_key = last_name + first_initial + phone-last-4.'

#### `staging.person_merge_review`

Candidate pairs queued for manual review (70-95% confidence).

| Column | Type | Constraints |
|---|---|---|
| `review_id` | BIGSERIAL | PRIMARY KEY |
| `run_id` | BIGINT | NOT NULL, FK → dedup_run |
| `candidate_a_id` | BIGINT | NOT NULL, FK → person_candidate |
| `candidate_b_id` | BIGINT | NOT NULL, FK → person_candidate |
| `confidence_score` | NUMERIC | NOT NULL |
| `status` | staging.merge_review_status | NOT NULL DEFAULT 'PENDING' |
| `reviewed_by` | TEXT | |
| `reviewed_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

- Constraint: `UNIQUE(candidate_a_id, candidate_b_id)`
- Index: `idx_merge_review_status` ON (status)
- Comment: 'Person merge review queue. Pairs at 70-95% confidence for manual resolution.'

---

## Phase 3: Pipeline Scripts + Python Stub

### Directory Structure

```
db/staging/
  cleanse_person.sql
  validate_person.sql
  promote_person.sql
  README.md

etl/
  loader.py
  requirements.txt
```

These are NOT Flyway migrations. They are standalone operational scripts.

### `db/staging/cleanse_person.sql`

Updates `stg_person` rows where `row_status = 'RAW'` for a given batch:

- Trim whitespace on all `raw_*` columns
- Normalize `raw_gender`: uppercase, map common variants ('M'→'MALE', 'F'→'FEMALE')
- Normalize `raw_phone`: strip non-digit characters
- Normalize `raw_branch_code`: uppercase, trim
- Normalize `raw_member_stage`: uppercase, trim
- Set `row_status = 'CLEANSED'` on processed rows
- Update batch status to 'CLEANSED'

Parameterized by batch_id (passed as psql variable `:batch_id`).

### `db/staging/validate_person.sql`

Checks `stg_person` rows where `row_status = 'CLEANSED'` for a given batch:

- Required fields: `raw_first_name`, `raw_last_name` must be non-empty
- `raw_gender` must be a valid `core.gender_type` value (MALE, FEMALE) or empty
- `raw_branch_code` must exist in `core.branch` if non-empty
- `raw_member_stage` must be a valid `membership.lifecycle_stage` code if non-empty
- Accumulates errors into `validation_errors` as a JSONB array of objects (`[{"field":"raw_gender","error":"invalid value: X"}]`)
- Sets `row_status = 'VALID'` (no errors) or `'INVALID'` (has errors)
- Update batch status to 'VALIDATED'

Parameterized by batch_id.

### `db/staging/promote_person.sql`

Processes `stg_person` rows where `row_status = 'VALID'` for a given batch, in FK order:

1. INSERT into `core.address` (if `raw_address_line1` non-empty) — capture address_id
2. INSERT into `core.person` (first_name, last_name, middle_name, suffix, gender, birth_date) — capture person_id
3. INSERT into `core.contact_info` (email and/or phone rows) — if non-empty
4. INSERT into `membership.member` (if `raw_member_code` non-empty) — capture member_id
5. UPDATE `stg_person` SET `promoted_to_person_id`, `promoted_to_member_id`, `promoted_at`, `row_status = 'PROMOTED'`
6. Update batch status to 'PROMOTED'

Runs in a single transaction. Parameterized by batch_id.

### `etl/loader.py`

Minimal Python stub:

- CLI: `python loader.py --csv <path>` (Google Sheets auth deferred)
- Reads CSV into pandas DataFrame
- Creates an `import_batch` row (source_name from filename, status='LOADING')
- Bulk-inserts rows into `stg_person` via psycopg2 `executemany`
- Maps CSV column headers to `raw_*` columns (configurable header mapping dict)
- Updates batch row_count and status='LOADED'
- Connection string from `DATABASE_URL` environment variable

### `etl/requirements.txt`

```
psycopg2-binary>=2.9
pandas>=2.0
gspread>=6.0
```

### `db/staging/README.md`

Documents:
- The 4-phase pipeline (load → cleanse → validate → promote)
- How to run each phase (psql commands with batch_id variable)
- How to add a new sheet: create `stg_<name>` table, write cleanse/validate/promote SQL
- The staging table pattern (required columns)
- Error handling: invalid rows stay in staging, fix in source and re-load or update manually

---

## Cross-Cutting Concerns

### Conventions

Same as Plans 1-3b. Migration numbering continues from V059.

### What's NOT in scope

- Google Sheets authentication (deferred until real sheets available)
- Dedup matching logic (blocking key generation, fuzzy matching, confidence scoring)
- Staging tables for other sheets beyond `stg_person`
- Admin UI for merge review
- Automated scheduling or orchestration
- Rollback/undo for promoted rows
