BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_semester', 'bc_semester table exists');
SELECT has_table('education', 'bc_course', 'bc_course table exists');

INSERT INTO education.bc_semester (name, academic_year, term_number, starts_on, ends_on)
  VALUES ('1st Sem AY 2024-2025', '2024-2025', 1, '2024-06-01', '2024-10-31')
  RETURNING semester_id \gset
SELECT pass('bc_semester insert succeeds');

-- Default status
SELECT is(
  (SELECT status::text FROM education.bc_semester WHERE semester_id = :semester_id),
  'PLANNED',
  'semester defaults to PLANNED'
);

INSERT INTO education.bc_course (code, title, credits, department)
  VALUES ('THE101', 'Introduction to Theology', 3, 'Theology')
  RETURNING course_id \gset
SELECT pass('bc_course insert succeeds');

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO education.bc_semester (name, status) VALUES ('X', 'BOGUS')$$,
  '22P02', NULL, 'invalid semester_status rejected'
);

-- Unique course code
PREPARE dup_course AS INSERT INTO education.bc_course (code, title) VALUES ('THE101', 'Dup');
SELECT throws_ok('dup_course', '23505', NULL, 'duplicate course code rejected');

SELECT * FROM finish();
ROLLBACK;
