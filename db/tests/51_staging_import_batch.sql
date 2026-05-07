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
