BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_category', 'event_category exists');
SELECT has_table('events', 'event_type', 'event_type exists');
SELECT col_is_pk('events', 'event_category', 'category_code', 'category_code is PK');
SELECT col_is_unique('events', 'event_type', ARRAY['code'], 'event_type.code is unique');
SELECT has_fk('events', 'event_type', 'event_type has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('TEST_CAT', 'Test');
INSERT INTO events.event_type (code, name, category_code, typical_duration_minutes)
  VALUES ('TEST_EVT', 'Test Event', 'TEST_CAT', 60);
SELECT pass('category + type insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event_type (code, name, category_code) VALUES ('X', 'X', 'NONEXISTENT')$$,
  '23503', NULL, 'invalid category_code rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
