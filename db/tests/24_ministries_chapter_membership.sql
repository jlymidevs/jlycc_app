BEGIN;
SELECT plan(8);

SELECT has_table('ministries', 'ministry_chapter', 'chapter table exists');
SELECT has_table('ministries', 'ministry_membership', 'membership table exists');

INSERT INTO ministries.network (code, name) VALUES ('N', 'N') RETURNING network_id \gset
INSERT INTO ministries.ministry (network_id, code, name) VALUES (:network_id, 'M', 'M') RETURNING ministry_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES (:ministry_id, :branch_id) RETURNING chapter_id \gset
SELECT pass('chapter insert succeeds');

PREPARE dup_chapter AS
  INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES (:ministry_id, :branch_id);
SELECT throws_ok('dup_chapter', '23505', NULL, 'duplicate (ministry, branch) rejected');

INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
  VALUES (:chapter_id, :member_id, now(), true, 'HEAD');
SELECT pass('leader membership insert succeeds');

SELECT throws_ok(
  format($$INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
    VALUES (%L, %L, now(), true, NULL)$$, :chapter_id, :member_id),
  '23514', NULL, 'leader without role rejected by CHECK'
);

SELECT throws_ok(
  format($$INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
    VALUES (%L, %L, now(), false, 'HEAD')$$, :chapter_id, :member_id),
  '23514', NULL, 'non-leader with role rejected by CHECK'
);

SELECT throws_ok(
  $$INSERT INTO ministries.ministry_chapter (ministry_id, branch_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid chapter_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
