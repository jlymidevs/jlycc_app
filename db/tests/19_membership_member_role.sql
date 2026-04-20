BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'member_role', 'member_role exists');

INSERT INTO core.region (code, name, type) VALUES ('R','R','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B','B',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A','X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-26-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :member_id, role_id, :branch_id, now() FROM membership.role WHERE code='PASTOR';
SELECT pass('member_role insert');

INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :member_id, role_id, :branch_id, now() FROM membership.role WHERE code='ADMIN_STAFF';
SELECT pass('stacking second role works');

SELECT * FROM finish();
ROLLBACK;
