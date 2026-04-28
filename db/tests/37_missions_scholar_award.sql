BEGIN;
SELECT plan(6);

SELECT has_table('missions', 'scholar_program', 'scholar_program exists');
SELECT has_table('missions', 'scholarship_award', 'scholarship_award exists');
SELECT has_fk('missions', 'scholarship_award', 'award has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Scholar', 'X') RETURNING person_id AS s_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Sponsor', 'Y') RETURNING person_id AS sp_pid \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:s_pid, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id AS s_mid \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:sp_pid, :branch_id, 'B-2', 'REGULAR_MEMBER', now()) RETURNING member_id AS sp_mid \gset

INSERT INTO missions.scholar_program (name, status) VALUES ('2026 Scholarship', 'ACTIVE')
  RETURNING program_id \gset

INSERT INTO missions.scholarship_award (program_id, member_id, school_name, amount, sponsor_member_id, status)
  VALUES (:program_id, :s_mid, 'UP Diliman', 25000, :sp_mid, 'ACTIVE');
SELECT pass('award insert with sponsor succeeds');

SELECT throws_ok(
  $$INSERT INTO missions.scholarship_award (program_id, member_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid award_status rejected'
);

SELECT throws_ok(
  $$INSERT INTO missions.scholar_program (name, status) VALUES ('X', 'BOGUS')$$,
  '22P02', NULL, 'invalid program_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
