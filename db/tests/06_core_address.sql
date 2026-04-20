BEGIN;
SELECT plan(8);

SELECT has_table('core', 'address', 'core.address exists');
SELECT has_pk('core', 'address', 'core.address has a PK');
SELECT col_not_null('core', 'address', 'country_code', 'country_code is NOT NULL');
SELECT col_not_null('core', 'address', 'line1', 'line1 is NOT NULL');
SELECT fk_ok('core', 'branch', 'primary_address_id', 'core', 'address', 'address_id',
  'branch.primary_address_id references address.address_id');

INSERT INTO core.address (line1, city, country_code) VALUES ('123 Main St', 'Manila', 'PH');
SELECT pass('insert succeeds');

PREPARE bad_cc AS INSERT INTO core.address (line1, country_code) VALUES ('X', 'ph');
SELECT throws_ok('bad_cc', '23514', NULL, 'lowercase country_code rejected by CHECK');

PREPARE bad_cc2 AS INSERT INTO core.address (line1, country_code) VALUES ('X', 'PHX');
SELECT throws_ok('bad_cc2', '22001', NULL, 'three-char country_code rejected by CHAR(2)');

SELECT * FROM finish();
ROLLBACK;
