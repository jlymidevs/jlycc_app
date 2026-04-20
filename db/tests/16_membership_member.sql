BEGIN;
SELECT plan(7);

SELECT has_table('membership', 'member', 'member table exists');
SELECT has_pk('membership', 'member', 'PK exists');
SELECT col_is_unique('membership', 'member', ARRAY['person_id'], 'one member per person');
SELECT col_is_unique('membership', 'member', ARRAY['member_code'], 'member_code unique');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL', 'Manila', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at, status)
  VALUES (:person_id, :branch_id, 'MNL-2026-000001', 'FTV', now(), 'ACTIVE');
SELECT pass('member insert succeeds');

INSERT INTO core.person (first_name, last_name) VALUES ('B', 'Y') RETURNING person_id AS bad_pid \gset
PREPARE bad_stage AS
  INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at, status)
  VALUES (:bad_pid, :branch_id, 'X', 'BOGUS', now(), 'ACTIVE');
SELECT throws_ok('bad_stage', '23503', NULL, 'invalid stage rejected via FK');

SELECT col_not_null('membership', 'member', 'joined_at', 'joined_at NOT NULL');

SELECT * FROM finish();
ROLLBACK;
