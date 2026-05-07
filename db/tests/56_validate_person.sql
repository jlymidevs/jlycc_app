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
