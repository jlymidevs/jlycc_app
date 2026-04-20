BEGIN;
SELECT plan(7);

SELECT has_table('core', 'region', 'core.region table exists');
SELECT has_pk('core', 'region', 'core.region has a primary key');
SELECT col_not_null('core', 'region', 'code', 'code is NOT NULL');
SELECT col_not_null('core', 'region', 'name', 'name is NOT NULL');
SELECT col_not_null('core', 'region', 'type', 'type is NOT NULL');
SELECT col_is_unique('core', 'region', ARRAY['code'], 'code is unique');

INSERT INTO core.region (code, name, type) VALUES ('NCR', 'National Capital Region', 'LOCAL_CLUSTER');
SELECT pass('insert succeeds');

SELECT * FROM finish();
ROLLBACK;
