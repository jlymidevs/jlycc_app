BEGIN;
SELECT plan(4);

SET LOCAL ROLE app_general;
PREPARE cohort_read AS SELECT cohort_id FROM programs.heartlink_cohort LIMIT 1;
SELECT lives_ok('cohort_read', 'app_general can read programs.heartlink_cohort');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE program_read AS SELECT program_id FROM missions.scholar_program LIMIT 1;
SELECT lives_ok('program_read', 'app_general can read missions.scholar_program');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE award_read AS SELECT award_id FROM missions.scholarship_award LIMIT 1;
SELECT lives_ok('award_read', 'app_pastoral can read missions.scholarship_award');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE bac_read AS SELECT initiative_id FROM missions.bac_initiative LIMIT 1;
SELECT lives_ok('bac_read', 'app_pastoral can read missions.bac_initiative');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
