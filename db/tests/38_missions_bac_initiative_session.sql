BEGIN;
SELECT plan(5);

SELECT has_table('missions', 'bac_initiative', 'bac_initiative exists');
SELECT has_table('missions', 'bac_session', 'bac_session exists');
SELECT has_fk('missions', 'bac_initiative', 'initiative has FK');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO missions.bac_initiative (branch_id, name, target_community, coordinator_member_id, status)
  VALUES (:branch_id, 'Bless Tondo 2026', 'Tondo, Manila', :member_id, 'ACTIVE')
  RETURNING initiative_id \gset

INSERT INTO missions.bac_session (initiative_id, session_number, topic, facilitator_member_id)
  VALUES (:initiative_id, 1, 'Who is Jesus?', :member_id);
SELECT pass('initiative + session insert succeeds');

SELECT throws_ok(
  $$INSERT INTO missions.bac_initiative (branch_id, name, status) VALUES (1, 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid initiative_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
