BEGIN;
SELECT plan(6);

SELECT has_table('attendance', 'check_in', 'check_in table exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular')
  ON CONFLICT DO NOTHING;
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  ON CONFLICT DO NOTHING;
SELECT event_type_id FROM events.event_type WHERE code = 'SVC' \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Sunday Apr 20', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

-- Insert into April 2026 partition
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:event_id, :person_id, :branch_id, '2026-04-20 09:15:00+08', 'USHER');
SELECT pass('check_in insert routes to April partition');

-- Verify row lands in correct partition
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in_2026_04),
  1,
  'row exists in check_in_2026_04 partition'
);

-- Insert into May 2026 partition
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :person_id, :branch_id, '2026-05-04 09:15:00+08');
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in_2026_05),
  1,
  'row exists in check_in_2026_05 partition'
);

SELECT throws_ok(
  $$INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
    VALUES (1, 1, 1, '2026-04-20 09:00:00+08', 'BOGUS')$$,
  '22P02', NULL, 'invalid check_in_method rejected'
);

-- Total via parent
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in),
  2,
  'parent table sees both partitions'
);

SELECT * FROM finish();
ROLLBACK;
