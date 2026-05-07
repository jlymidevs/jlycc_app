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
