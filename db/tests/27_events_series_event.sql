BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_series', 'event_series exists');
SELECT has_table('events', 'event', 'event exists');
SELECT has_fk('events', 'event', 'event has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  RETURNING event_type_id \gset

INSERT INTO events.event_series (event_type_id, name, recurrence_pattern, starts_on)
  VALUES (:event_type_id, 'Weekly Service', 'WEEKLY', CURRENT_DATE)
  RETURNING series_id \gset
SELECT pass('series insert succeeds');

INSERT INTO events.event (event_type_id, series_id, name, starts_at, status)
  VALUES (:event_type_id, :series_id, 'Sunday Service Apr 20', now(), 'SCHEDULED');
SELECT pass('event insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event (event_type_id, name, starts_at, status)
    VALUES (1, 'X', now(), 'BOGUS')$$,
  '22P02', NULL, 'invalid event_status rejected'
);

SELECT throws_ok(
  $$INSERT INTO events.event_series (event_type_id, name, recurrence_pattern, starts_on)
    VALUES (1, 'X', 'BOGUS', CURRENT_DATE)$$,
  '22P02', NULL, 'invalid recurrence_pattern rejected'
);

SELECT * FROM finish();
ROLLBACK;
