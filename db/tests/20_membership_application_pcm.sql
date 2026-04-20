BEGIN;
SELECT plan(5);

SELECT has_table('membership', 'regular_member_application', 'application table exists');
SELECT has_table('membership', 'pastoral_care_assignment', 'pcm table exists');

INSERT INTO core.region (code, name, type) VALUES ('R','R','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B','B',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Carer','X') RETURNING person_id AS c_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Cared','X') RETURNING person_id AS cared_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:c_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id AS carer_member_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:cared_id, :branch_id, 'B-2', 'OGV', now()) RETURNING member_id AS cared_member_id \gset

INSERT INTO membership.regular_member_application (member_id, status, criteria_checklist)
  VALUES (:cared_member_id, 'PENDING', '{"attended_4_services":true,"heartlink_completed":false}'::jsonb);
SELECT pass('application insert with JSONB checklist');

INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:carer_member_id, :cared_member_id, now());
SELECT pass('pcm assignment insert');

PREPARE dup_active AS
  INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:carer_member_id, :cared_member_id, now());
SELECT throws_ok('dup_active', '23505', NULL, 'second active PCM assignment for same person rejected');

SELECT * FROM finish();
ROLLBACK;
