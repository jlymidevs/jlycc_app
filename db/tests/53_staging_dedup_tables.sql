BEGIN;
SELECT plan(9);

SELECT has_table('staging', 'dedup_run', 'dedup_run table exists');
SELECT has_table('staging', 'person_candidate', 'person_candidate table exists');
SELECT has_table('staging', 'person_merge_review', 'person_merge_review table exists');

-- Setup: batch + stg_person rows
INSERT INTO staging.import_batch (source_name) VALUES ('Test')
  RETURNING batch_id \gset
INSERT INTO staging.stg_person (batch_id, raw_first_name, raw_last_name)
  VALUES (:'batch_id', 'Juan', 'Dela Cruz')
  RETURNING staging_id AS sid1 \gset
INSERT INTO staging.stg_person (batch_id, raw_first_name, raw_last_name)
  VALUES (:'batch_id', 'Juan', 'De La Cruz')
  RETURNING staging_id AS sid2 \gset

-- Dedup run
INSERT INTO staging.dedup_run (batch_id, candidates_found, auto_merged, queued_for_review, distinct_persons)
  VALUES (:'batch_id', 2, 0, 1, 1)
  RETURNING run_id \gset
SELECT pass('dedup_run insert succeeds');

-- Person candidates
INSERT INTO staging.person_candidate (run_id, staging_id, first_name, last_name, blocking_key)
  VALUES (:run_id, :sid1, 'Juan', 'Dela Cruz', 'DELACRUZ-J')
  RETURNING candidate_id AS ca \gset
INSERT INTO staging.person_candidate (run_id, staging_id, first_name, last_name, blocking_key)
  VALUES (:run_id, :sid2, 'Juan', 'De La Cruz', 'DELACRUZ-J')
  RETURNING candidate_id AS cb \gset
SELECT pass('person_candidate inserts succeed');

-- Merge review
INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score)
  VALUES (:run_id, :ca, :cb, 0.85)
  RETURNING review_id \gset
SELECT pass('person_merge_review insert succeeds');

-- Default review status
SELECT is(
  (SELECT status::text FROM staging.person_merge_review WHERE review_id = :review_id),
  'PENDING',
  'merge review defaults to PENDING'
);

-- Unique (candidate_a, candidate_b)
PREPARE dup_review AS
  INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score)
  VALUES (:run_id, :ca, :cb, 0.90);
SELECT throws_ok('dup_review', '23505', NULL, 'duplicate (candidate_a, candidate_b) rejected');

-- Invalid merge_review_status
SELECT throws_ok(
  $$INSERT INTO staging.person_merge_review (run_id, candidate_a_id, candidate_b_id, confidence_score, status)
    VALUES (1, 1, 2, 0.5, 'BOGUS')$$,
  '22P02', NULL, 'invalid merge_review_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
