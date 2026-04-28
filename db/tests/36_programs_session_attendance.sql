BEGIN;
SELECT plan(6);

SELECT has_table('programs', 'heartlink_session', 'session table exists');
SELECT has_table('programs', 'heartlink_session_attendance', 'attendance table exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

INSERT INTO programs.heartlink_cohort (branch_id, name, status)
  VALUES (:branch_id, 'Test Cohort', 'ACTIVE') RETURNING cohort_id \gset
INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id) RETURNING enrollment_id \gset
INSERT INTO programs.heartlink_session (cohort_id, session_number, topic)
  VALUES (:cohort_id, 1, 'Introduction') RETURNING session_id \gset
SELECT pass('session insert succeeds');

INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:session_id, :enrollment_id, true);
SELECT pass('attendance insert succeeds');

PREPARE dup_att AS
  INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:session_id, :enrollment_id, false);
SELECT throws_ok('dup_att', '23505', NULL, 'duplicate (session, enrollment) rejected');

SELECT col_not_null('programs', 'heartlink_session_attendance', 'attended', 'attended NOT NULL');

SELECT * FROM finish();
ROLLBACK;
