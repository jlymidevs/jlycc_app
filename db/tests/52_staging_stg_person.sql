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
