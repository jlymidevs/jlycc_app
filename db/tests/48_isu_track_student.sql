BEGIN;
SELECT plan(8);

SELECT has_table('education', 'isu_track', 'isu_track table exists');
SELECT has_table('education', 'isu_student', 'isu_student table exists');
SELECT has_fk('education', 'isu_student', 'isu_student has FK');

INSERT INTO education.isu_track (code, name, order_index)
  VALUES ('FOUNDATIONS', 'Foundations', 1)
  RETURNING track_id \gset
SELECT pass('isu_track insert succeeds');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.isu_student (person_id, current_track_id, enrolled_on)
  VALUES (:person_id, :track_id, '2024-06-01')
  RETURNING student_id \gset
SELECT pass('isu_student insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.isu_student WHERE student_id = :student_id),
  'ACTIVE',
  'isu_student defaults to ACTIVE'
);

-- Unique person_id
PREPARE dup_isu_person AS
  INSERT INTO education.isu_student (person_id, enrolled_on) VALUES (:person_id, '2024-06-01');
SELECT throws_ok('dup_isu_person', '23505', NULL, 'duplicate person_id rejected');

-- Unique track code
PREPARE dup_track AS
  INSERT INTO education.isu_track (code, name, order_index) VALUES ('FOUNDATIONS', 'Dup', 2);
SELECT throws_ok('dup_track', '23505', NULL, 'duplicate track code rejected');

SELECT * FROM finish();
ROLLBACK;
