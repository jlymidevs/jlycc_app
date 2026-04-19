BEGIN;
SELECT plan(3);

SELECT has_extension('citext', 'citext extension exists');
SELECT has_extension('pg_trgm', 'pg_trgm extension exists');
SELECT has_extension('pgcrypto', 'pgcrypto extension exists');

SELECT * FROM finish();
ROLLBACK;
