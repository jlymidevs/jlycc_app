BEGIN;
SELECT plan(9);

SELECT has_table('education', 'bc_enrollment', 'bc_enrollment table exists');
SELECT has_table('education', 'bc_completion', 'bc_completion table exists');
SELECT has_fk('education', 'bc_enrollment', 'bc_enrollment has FK');

-- Setup: program -> cohort -> student, semester -> course -> offering
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Bachelor of Theology')
  RETURNING program_id \gset
INSERT INTO education.bc_cohort (program_id, name) VALUES (:program_id, 'BT 2028')
  RETURNING cohort_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X')
  RETURNING person_id \gset
INSERT INTO education.bc_student (person_id, cohort_id, student_number, enrolled_on)
  VALUES (:person_id, :cohort_id, 'BC-0001', '2024-06-01')
  RETURNING student_id \gset
INSERT INTO education.bc_semester (name) VALUES ('1st Sem')
  RETURNING semester_id \gset
INSERT INTO education.bc_course (code, title) VALUES ('THE101', 'Intro')
  RETURNING course_id \gset
INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:course_id, :semester_id)
  RETURNING offering_id \gset

-- Enrollment
INSERT INTO education.bc_enrollment (student_id, offering_id, enrolled_on)
  VALUES (:student_id, :offering_id, '2024-06-15')
  RETURNING enrollment_id \gset
SELECT pass('bc_enrollment insert succeeds');

-- Default enrollment status
SELECT is(
  (SELECT status::text FROM education.bc_enrollment WHERE enrollment_id = :enrollment_id),
  'ENROLLED',
  'enrollment defaults to ENROLLED'
);

-- Unique (student, offering)
PREPARE dup_enroll AS
  INSERT INTO education.bc_enrollment (student_id, offering_id, enrolled_on)
  VALUES (:student_id, :offering_id, '2024-06-15');
SELECT throws_ok('dup_enroll', '23505', NULL, 'duplicate (student, offering) rejected');

-- Completion 1:1
INSERT INTO education.bc_completion (enrollment_id, status, completed_on, attendance_rate)
  VALUES (:enrollment_id, 'COMPLETED', '2024-10-31', 0.92);
SELECT pass('bc_completion insert succeeds');

SELECT is(
  (SELECT attendance_rate FROM education.bc_completion WHERE enrollment_id = :enrollment_id),
  0.92::numeric,
  'attendance_rate stored correctly'
);

-- Duplicate completion (1:1 PK)
PREPARE dup_comp AS
  INSERT INTO education.bc_completion (enrollment_id, status)
  VALUES (:enrollment_id, 'COMPLETED');
SELECT throws_ok('dup_comp', '23505', NULL, 'duplicate completion (1:1 PK) rejected');

SELECT * FROM finish();
ROLLBACK;
