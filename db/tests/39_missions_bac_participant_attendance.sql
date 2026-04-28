BEGIN;
SELECT plan(7);

SELECT has_table('missions', 'bac_participant', 'participant table exists');
SELECT has_table('missions', 'bac_session_attendance', 'bac attendance table exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Enrolled', 'X') RETURNING person_id AS enrolled_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('WalkIn', 'Y') RETURNING person_id AS walkin_pid \gset

INSERT INTO missions.bac_initiative (branch_id, name, status)
  VALUES (:branch_id, 'Bless Tondo', 'ACTIVE') RETURNING initiative_id \gset

INSERT INTO missions.bac_participant (initiative_id, person_id, role)
  VALUES (:initiative_id, :enrolled_pid, 'PARTICIPANT');
SELECT pass('participant insert succeeds');

INSERT INTO missions.bac_session (initiative_id, session_number, topic)
  VALUES (:initiative_id, 1, 'Session 1') RETURNING session_id \gset

INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :enrolled_pid, true, 'ENROLLED');
SELECT pass('enrolled attendance insert succeeds');

INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :walkin_pid, true, 'WALK_IN');
SELECT pass('walk-in attendance insert succeeds');

PREPARE dup_bac_att AS
  INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:session_id, :enrolled_pid, false, 'ENROLLED');
SELECT throws_ok('dup_bac_att', '23505', NULL, 'duplicate (session, person) rejected');

SELECT throws_ok(
  $$INSERT INTO missions.bac_participant (initiative_id, person_id, role)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid bac_role rejected'
);

SELECT * FROM finish();
ROLLBACK;
