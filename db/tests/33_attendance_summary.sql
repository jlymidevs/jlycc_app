BEGIN;
SELECT plan(3);

SELECT has_view('attendance', 'attendance_summary', 'summary view exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular') ON CONFLICT DO NOTHING;
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  ON CONFLICT DO NOTHING;
SELECT event_type_id FROM events.event_type WHERE code = 'SVC' \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Sunday', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id AS p1 \gset
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'Y') RETURNING person_id AS p2 \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :p1, :branch_id, '2026-04-20 09:10:00+08');
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :p2, :branch_id, '2026-04-20 09:12:00+08');

SELECT is(
  (SELECT total_check_ins::int FROM attendance.attendance_summary
   WHERE event_id = :event_id AND branch_id = :branch_id),
  2,
  'summary counts 2 check-ins'
);

SELECT is(
  (SELECT unique_persons::int FROM attendance.attendance_summary
   WHERE event_id = :event_id AND branch_id = :branch_id),
  2,
  'summary counts 2 unique persons'
);

SELECT * FROM finish();
ROLLBACK;
