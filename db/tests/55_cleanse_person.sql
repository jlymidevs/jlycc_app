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
