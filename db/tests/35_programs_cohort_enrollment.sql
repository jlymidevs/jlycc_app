BEGIN;
SELECT plan(8);

SELECT has_schema('programs', 'programs schema exists');
SELECT has_table('programs', 'heartlink_cohort', 'cohort table exists');
SELECT has_table('programs', 'heartlink_enrollment', 'enrollment table exists');
SELECT has_fk('programs', 'heartlink_cohort', 'cohort has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO programs.heartlink_cohort (branch_id, name, facilitator_member_id, status)
  VALUES (:branch_id, 'Manila Q1 2026', :member_id, 'ACTIVE')
  RETURNING cohort_id \gset
SELECT pass('cohort insert succeeds');

INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id);
SELECT pass('enrollment insert succeeds');

PREPARE dup_enroll AS
  INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:cohort_id, :person_id);
SELECT throws_ok('dup_enroll', '23505', NULL, 'duplicate (cohort, person) rejected');

SELECT throws_ok(
  $$INSERT INTO programs.heartlink_cohort (branch_id, name, status)
    VALUES (1, 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid cohort_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
