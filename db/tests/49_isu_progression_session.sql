BEGIN;
SELECT plan(9);

SELECT has_table('education', 'isu_track_progression', 'isu_track_progression table exists');
SELECT has_table('education', 'isu_session', 'isu_session table exists');
SELECT has_table('education', 'isu_session_attendance', 'isu_session_attendance table exists');

-- Setup
INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('FOUND', 'Foundations', 1) RETURNING track_id AS t1 \gset
INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('GROW', 'Growth', 2) RETURNING track_id AS t2 \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.isu_student (person_id, current_track_id, enrolled_on)
  VALUES (:person_id, :t1, '2024-06-01')
  RETURNING student_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset

-- Track progression: initial enrollment (from NULL)
INSERT INTO education.isu_track_progression (student_id, from_track_id, to_track_id, notes)
  VALUES (:student_id, NULL, :t1, 'Initial enrollment');
SELECT pass('initial track progression succeeds');

-- Progress to next track
INSERT INTO education.isu_track_progression (student_id, from_track_id, to_track_id)
  VALUES (:student_id, :t1, :t2);
SELECT is(
  (SELECT count(*)::int FROM education.isu_track_progression WHERE student_id = :student_id),
  2,
  'two progression records for student'
);

-- Session
INSERT INTO education.isu_session (branch_id, track_id, topic, scheduled_at)
  VALUES (:branch_id, :t1, 'Who is Jesus?', '2024-07-01 09:00:00+08')
  RETURNING session_id \gset
SELECT pass('isu_session insert succeeds');

-- Session attendance (uses person_id, not student_id)
INSERT INTO education.isu_session_attendance (session_id, person_id, attended)
  VALUES (:session_id, :person_id, true);
SELECT pass('isu_session_attendance insert succeeds');

-- Unique (session, person)
PREPARE dup_isu_att AS
  INSERT INTO education.isu_session_attendance (session_id, person_id, attended)
  VALUES (:session_id, :person_id, false);
SELECT throws_ok('dup_isu_att', '23505', NULL, 'duplicate (session, person) rejected');

-- FK on session
PREPARE bad_sess_fk AS
  INSERT INTO education.isu_session (branch_id, track_id)
  VALUES (:branch_id, 999999);
SELECT throws_ok('bad_sess_fk', '23503', NULL, 'invalid track_id FK rejected');

SELECT * FROM finish();
ROLLBACK;
