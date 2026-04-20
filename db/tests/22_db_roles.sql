BEGIN;
SELECT plan(8);

SELECT has_role('app_general', 'app_general role exists');
SELECT has_role('app_pastoral', 'app_pastoral role exists');
SELECT has_role('app_full', 'app_full role exists');

-- app_general should NOT be able to SELECT contact_info (full table revoke)
SET LOCAL ROLE app_general;
PREPARE pii_read AS SELECT contact_id FROM core.contact_info LIMIT 1;
SELECT throws_ok('pii_read', '42501', NULL, 'app_general cannot read core.contact_info');
RESET ROLE;

-- app_general should NOT be able to SELECT PII columns on core.person
SET LOCAL ROLE app_general;
PREPARE pii_dob AS SELECT date_of_birth FROM core.person LIMIT 1;
SELECT throws_ok('pii_dob', '42501', NULL, 'app_general cannot read person.date_of_birth');
RESET ROLE;

-- app_general CAN read non-PII columns on core.person
SET LOCAL ROLE app_general;
PREPARE non_pii AS SELECT person_id, first_name, last_name FROM core.person LIMIT 1;
SELECT lives_ok('non_pii', 'app_general can read non-PII person columns');
RESET ROLE;

-- app_pastoral CAN read contact_info
SET LOCAL ROLE app_pastoral;
PREPARE pii_read_ok AS SELECT contact_id FROM core.contact_info LIMIT 1;
SELECT lives_ok('pii_read_ok', 'app_pastoral can read core.contact_info');
RESET ROLE;

-- app_pastoral CAN read PII columns on person
SET LOCAL ROLE app_pastoral;
PREPARE pii_dob_ok AS SELECT date_of_birth FROM core.person LIMIT 1;
SELECT lives_ok('pii_dob_ok', 'app_pastoral can read person.date_of_birth');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
