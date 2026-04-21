BEGIN;
SELECT plan(5);

SELECT has_table('attendance', 'visitor_capture', 'visitor_capture exists');
SELECT has_fk('attendance', 'visitor_capture', 'visitor_capture has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular') ON CONFLICT DO NOTHING;
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  ON CONFLICT DO NOTHING;
SELECT event_type_id FROM events.event_type WHERE code = 'SVC' \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Service', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('FTV', 'Person') RETURNING person_id \gset

INSERT INTO attendance.visitor_capture (person_id, event_id, branch_id, consent_to_contact, intake_notes)
  VALUES (:person_id, :event_id, :branch_id, true, 'Invited by friend')
  RETURNING ftv_capture_id \gset
SELECT pass('visitor_capture insert succeeds');

-- check_in with ftv_capture_id FK
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
  VALUES (:event_id, :person_id, :branch_id, '2026-04-20 09:15:00+08', :ftv_capture_id);
SELECT pass('check_in with ftv_capture_id succeeds');

-- Invalid ftv_capture_id should fail
SELECT throws_ok(
  format($$INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
    VALUES (%L, %L, %L, '2026-04-20 09:30:00+08', 999999)$$, :event_id, :person_id, :branch_id),
  '23503', NULL, 'invalid ftv_capture_id rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
