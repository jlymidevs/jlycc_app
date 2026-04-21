BEGIN;
SELECT plan(5);

SELECT has_table('attendance', 'child_check_in', 'child_check_in exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular') ON CONFLICT DO NOTHING;
INSERT INTO events.event_type (code, name, category_code) VALUES ('KK', 'Kids', 'REGULAR')
  ON CONFLICT DO NOTHING;
SELECT event_type_id FROM events.event_type WHERE code = 'KK' \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Kingdom Kids Apr 20', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Parent', 'X') RETURNING person_id AS parent_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Child', 'X') RETURNING person_id AS child_pid \gset

-- Parent check-in
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :parent_pid, :branch_id, '2026-04-20 09:00:00+08')
  RETURNING check_in_id AS parent_ci_id, checked_in_at AS parent_ci_at \gset

-- Child check-in
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :child_pid, :branch_id, '2026-04-20 09:00:00+08')
  RETURNING check_in_id AS child_ci_id, checked_in_at AS child_ci_at \gset

INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, parent_check_in_id, parent_checked_in_at, pickup_code, allergies)
  VALUES (:child_ci_id, :'child_ci_at', :event_id, :parent_ci_id, :'parent_ci_at', 'MNL-K-0001', 'Peanuts');
SELECT pass('child_check_in insert succeeds');

-- Duplicate pickup_code for same event should fail
INSERT INTO core.person (first_name, last_name) VALUES ('Child2', 'X') RETURNING person_id AS child2_pid \gset
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :child2_pid, :branch_id, '2026-04-20 09:05:00+08')
  RETURNING check_in_id AS child2_ci_id, checked_in_at AS child2_ci_at \gset

PREPARE dup_code AS
  INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, parent_check_in_id, parent_checked_in_at, pickup_code)
  VALUES (:child2_ci_id, :'child2_ci_at', :event_id, :parent_ci_id, :'parent_ci_at', 'MNL-K-0001');
SELECT throws_ok('dup_code', '23505', NULL, 'duplicate pickup_code per event rejected');

-- Different event, same pickup_code should succeed
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Kingdom Kids Apr 27', '2026-04-27 09:00:00+08') RETURNING event_id AS event2_id \gset
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event2_id, :child2_pid, :branch_id, '2026-04-27 09:00:00+08')
  RETURNING check_in_id AS child3_ci_id, checked_in_at AS child3_ci_at \gset
INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, pickup_code)
  VALUES (:child3_ci_id, :'child3_ci_at', :event2_id, 'MNL-K-0001');
SELECT pass('same pickup_code allowed for different event');

SELECT col_not_null('attendance', 'child_check_in', 'pickup_code', 'pickup_code NOT NULL');

SELECT * FROM finish();
ROLLBACK;
