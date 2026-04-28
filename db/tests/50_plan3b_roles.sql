BEGIN;
SELECT plan(4);

SET LOCAL ROLE app_general;
PREPARE school_read AS SELECT school_id FROM education.school LIMIT 1;
SELECT lives_ok('school_read', 'app_general can read education.school');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE bc_student_read AS SELECT student_id FROM education.bc_student LIMIT 1;
SELECT lives_ok('bc_student_read', 'app_general can read education.bc_student');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE isu_student_read AS SELECT student_id FROM education.isu_student LIMIT 1;
SELECT lives_ok('isu_student_read', 'app_pastoral can read education.isu_student');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE bc_enrollment_read AS SELECT enrollment_id FROM education.bc_enrollment LIMIT 1;
SELECT lives_ok('bc_enrollment_read', 'app_pastoral can read education.bc_enrollment');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
