BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_student', 'bc_student table exists');
SELECT has_fk('education', 'bc_student', 'bc_student has FK');

-- Setup
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Bachelor of Theology')
  RETURNING program_id \gset
INSERT INTO education.bc_cohort (program_id, name) VALUES (:program_id, 'BT 2028')
  RETURNING cohort_id \gset
INSERT INTO core.person (first_name, last_name, gender) VALUES ('Juan', 'Student', 'MALE')
  RETURNING person_id \gset

INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-2024-0001', '2024-06-01')
  RETURNING student_id \gset
SELECT pass('bc_student insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.bc_student WHERE student_id = :student_id),
  'ACTIVE',
  'bc_student defaults to ACTIVE'
);

-- Unique person_id
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'Y') RETURNING person_id AS p2 \gset
PREPARE dup_person AS
  INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-2024-0099', '2024-06-01');
SELECT throws_ok('dup_person', '23505', NULL, 'duplicate person_id rejected');

-- Unique student_number (needs fresh person to avoid person_id conflict)
PREPARE dup_snum AS
  INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:p2, :cohort_id, 'BC-2024-0001', '2024-06-01');
SELECT throws_ok('dup_snum', '23505', NULL, 'duplicate student_number rejected');

-- Invalid enum
SELECT throws_ok(
  $$INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on, status)
    VALUES (1, 1, 'XX', '2024-01-01', 'BOGUS')$$,
  '22P02', NULL, 'invalid bc_student_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
