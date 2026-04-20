BEGIN;
SELECT plan(4);

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL', 'Manila', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id AS mnl_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('CEB', 'Cebu',   :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id AS ceb_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :mnl_id, 'MNL-2026-1', 'FTV', now()) RETURNING member_id \gset

-- Trigger lifecycle change
UPDATE membership.member SET current_stage = 'OGV' WHERE member_id = :member_id;
SELECT is(
  (SELECT count(*)::int FROM membership.lifecycle_stage_history WHERE member_id = :member_id),
  1,
  'lifecycle history row inserted on stage change'
);
SELECT is(
  (SELECT to_stage FROM membership.lifecycle_stage_history WHERE member_id = :member_id),
  'OGV',
  'history records new stage'
);

-- Trigger branch transfer
UPDATE membership.member SET branch_id = :ceb_id WHERE member_id = :member_id;
SELECT is(
  (SELECT count(*)::int FROM membership.branch_membership_history WHERE member_id = :member_id),
  1,
  'branch history row inserted on transfer'
);
SELECT is(
  (SELECT to_branch_id FROM membership.branch_membership_history WHERE member_id = :member_id),
  :ceb_id::bigint,
  'history records new branch'
);

SELECT * FROM finish();
ROLLBACK;
