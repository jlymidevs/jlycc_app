BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_program', 'bc_program table exists');
SELECT has_table('education', 'bc_cohort', 'bc_cohort table exists');
SELECT has_fk('education', 'bc_cohort', 'bc_cohort has FK');

INSERT INTO education.bc_program (code, name, degree_level, total_credits, duration_years)
  VALUES ('BT', 'Bachelor of Theology', 'Bachelor', 120, 4)
  RETURNING program_id \gset
SELECT pass('bc_program insert succeeds');

INSERT INTO education.bc_cohort (program_id, name, starts_on, expected_graduation_on)
  VALUES (:program_id, 'BT Class of 2028', '2024-06-01', '2028-03-31')
  RETURNING cohort_id \gset
SELECT pass('bc_cohort insert succeeds');

-- Unique program code
PREPARE dup_prog AS INSERT INTO education.bc_program (code, name) VALUES ('BT', 'Duplicate');
SELECT throws_ok('dup_prog', '23505', NULL, 'duplicate program code rejected');

-- FK violation
PREPARE bad_cohort_fk AS INSERT INTO education.bc_cohort (program_id, name) VALUES (999999, 'Bad');
SELECT throws_ok('bad_cohort_fk', '23503', NULL, 'invalid program_id FK rejected');

SELECT * FROM finish();
ROLLBACK;
