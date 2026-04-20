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
