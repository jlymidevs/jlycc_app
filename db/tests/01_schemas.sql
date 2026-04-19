BEGIN;
SELECT plan(2);

SELECT has_schema('core', 'core schema exists');
SELECT has_schema('membership', 'membership schema exists');

SELECT * FROM finish();
ROLLBACK;
