BEGIN;
SELECT plan(8);

SELECT has_table('core', 'person', 'core.person exists');
SELECT has_pk('core', 'person', 'PK exists');
SELECT col_not_null('core', 'person', 'first_name', 'first_name NOT NULL');
SELECT col_not_null('core', 'person', 'last_name', 'last_name NOT NULL');
SELECT col_has_default('core', 'person', 'created_at', 'created_at has default');
SELECT col_is_null('core', 'person', 'deleted_at', 'deleted_at is nullable');

INSERT INTO core.person (first_name, last_name, gender)
  VALUES ('Juan', 'Dela Cruz', 'MALE');
SELECT pass('insert succeeds');

-- Backdate created_at so the trigger's now() on UPDATE is verifiably newer.
-- (Within a single transaction now() is frozen to transaction_timestamp(),
-- so created_at at INSERT and updated_at after the trigger fire on UPDATE
-- both resolve to the same instant. We disable the trigger only for the
-- backdating UPDATE so the trigger doesn't clobber it.)
ALTER TABLE core.person DISABLE TRIGGER trg_person_updated_at;
UPDATE core.person SET created_at = now() - interval '1 hour' WHERE first_name = 'Juan';
ALTER TABLE core.person ENABLE TRIGGER trg_person_updated_at;

UPDATE core.person SET preferred_name = 'JD' WHERE first_name = 'Juan';
SELECT cmp_ok(
  (SELECT updated_at FROM core.person WHERE first_name = 'Juan'),
  '>',
  (SELECT created_at FROM core.person WHERE first_name = 'Juan'),
  'updated_at trigger fires on UPDATE'
);

SELECT * FROM finish();
ROLLBACK;
