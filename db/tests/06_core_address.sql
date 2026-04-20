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
