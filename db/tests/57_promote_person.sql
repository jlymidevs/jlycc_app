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
