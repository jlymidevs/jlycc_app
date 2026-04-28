BEGIN;
SELECT plan(6);

SELECT has_table('education', 'bc_class_attendance', 'bc_class_attendance table exists');
SELECT has_fk('education', 'bc_class_attendance', 'bc_class_attendance has FK');

-- Setup
INSERT INTO education.bc_program (code, name) VALUES ('BT', 'BT')
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

INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-01', true);
SELECT pass('bc_class_attendance insert succeeds');

INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-08', false);
SELECT pass('second class_date insert succeeds');

-- Unique (offering, student, class_date)
PREPARE dup_att AS
  INSERT INTO education.bc_class_attendance (offering_id, student_id, class_date, attended)
  VALUES (:offering_id, :student_id, '2024-07-01', false);
SELECT throws_ok('dup_att', '23505', NULL, 'duplicate (offering, student, class_date) rejected');

-- Count
SELECT is(
  (SELECT count(*)::int FROM education.bc_class_attendance WHERE offering_id = :offering_id),
  2,
  'two attendance records for offering'
);

SELECT * FROM finish();
ROLLBACK;
