BEGIN;
SELECT plan(4);

SET LOCAL ROLE app_general;
PREPARE batch_read AS SELECT batch_id FROM staging.import_batch LIMIT 1;
SELECT lives_ok('batch_read', 'app_general can read staging.import_batch');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE stg_person_read AS SELECT staging_id FROM staging.stg_person LIMIT 1;
SELECT lives_ok('stg_person_read', 'app_general can read staging.stg_person');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE dedup_read AS SELECT run_id FROM staging.dedup_run LIMIT 1;
SELECT lives_ok('dedup_read', 'app_pastoral can read staging.dedup_run');
RESET ROLE;

SET LOCAL ROLE app_pastoral;
PREPARE review_read AS SELECT review_id FROM staging.person_merge_review LIMIT 1;
SELECT lives_ok('review_read', 'app_pastoral can read staging.person_merge_review');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
