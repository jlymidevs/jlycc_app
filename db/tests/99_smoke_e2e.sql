BEGIN;
SELECT plan(8);

-- Set up region, branch
INSERT INTO core.region (code, name, type) VALUES ('NCR','National Capital Region','LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('MNL-HQ','Manila HQ',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id \gset

-- Create a household with an address
INSERT INTO core.address (line1, city, country_code) VALUES ('1 Faith Ave','Manila','PH') RETURNING address_id \gset

INSERT INTO core.person (first_name, last_name, gender) VALUES ('Juan','Dela Cruz','MALE') RETURNING person_id AS jdc_id \gset
INSERT INTO core.person (first_name, last_name, gender) VALUES ('Maria','Dela Cruz','FEMALE') RETURNING person_id AS mdc_id \gset

INSERT INTO core.household (branch_id, name, primary_address_id, head_of_household_id)
  VALUES (:branch_id, 'The Dela Cruz Family', :address_id, :jdc_id) RETURNING household_id \gset

INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :jdc_id, 'HEAD', now());
INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :mdc_id, 'SPOUSE', now());

-- Spouse kinship link
INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:jdc_id, :mdc_id, 'SPOUSE', CURRENT_DATE);

SELECT is(
  (SELECT count(*)::int FROM core.kinship_bidirectional
   WHERE person_id IN (:jdc_id, :mdc_id) AND relationship='SPOUSE'),
  2,
  'spouse appears bidirectionally in kinship view'
);

-- Make Juan an FTV-stage member
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:jdc_id, :branch_id, 'MNL-2026-000001', 'FTV', now()) RETURNING member_id AS jdc_member \gset

SELECT is(
  (SELECT current_stage FROM membership.member WHERE member_id = :jdc_member),
  'FTV',
  'member starts as FTV'
);

-- Promote through the journey
UPDATE membership.member SET current_stage = 'OGV' WHERE member_id = :jdc_member;
UPDATE membership.member SET current_stage = 'RA'  WHERE member_id = :jdc_member;
UPDATE membership.member SET current_stage = 'REGULAR_MEMBER', regular_member_since = now()
  WHERE member_id = :jdc_member;

SELECT is(
  (SELECT count(*)::int FROM membership.lifecycle_stage_history WHERE member_id = :jdc_member),
  3,
  'three lifecycle transitions recorded'
);

-- Stack roles: PASTOR + ADMIN_STAFF
INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :jdc_member, role_id, :branch_id, now() FROM membership.role WHERE code='PASTOR';
INSERT INTO membership.member_role (member_id, role_id, branch_id, assigned_at)
  SELECT :jdc_member, role_id, :branch_id, now() FROM membership.role WHERE code='ADMIN_STAFF';

SELECT is(
  (SELECT count(*)::int FROM membership.member_role
   WHERE member_id = :jdc_member AND ended_at IS NULL),
  2,
  'two roles stacked on the same member'
);

-- PCM assignment: Maria becomes a member and gets assigned to Juan
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:mdc_id, :branch_id, 'MNL-2026-000002', 'OGV', now()) RETURNING member_id AS mdc_member \gset

INSERT INTO membership.pastoral_care_assignment (carer_member_id, assigned_member_id, assigned_at)
  VALUES (:jdc_member, :mdc_member, now());

SELECT is(
  (SELECT count(*)::int FROM membership.pastoral_care_assignment
   WHERE assigned_member_id = :mdc_member AND ended_at IS NULL),
  1,
  'PCM assignment active for Maria'
);

-- Soft delete check
UPDATE core.person SET deleted_at = now() WHERE person_id = :mdc_id;
SELECT is(
  (SELECT count(*)::int FROM core.person_active WHERE person_id = :mdc_id),
  0,
  'soft-deleted person hidden from person_active view'
);

-- Branch transfer
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('CEB','Cebu',:region_id,'LOCAL','PH','Asia/Manila') RETURNING branch_id AS ceb_id \gset
UPDATE membership.member SET branch_id = :ceb_id WHERE member_id = :jdc_member;
SELECT is(
  (SELECT count(*)::int FROM membership.branch_membership_history WHERE member_id = :jdc_member),
  1,
  'branch transfer recorded in history'
);

-- Application with JSONB checklist
INSERT INTO membership.regular_member_application (member_id, status, criteria_checklist)
  VALUES (:jdc_member, 'APPROVED',
          '{"attended_4_services":true,"heartlink_completed":true,"interview_done":true}'::jsonb);
SELECT is(
  (SELECT criteria_checklist->'heartlink_completed' FROM membership.regular_member_application
   WHERE member_id = :jdc_member),
  'true'::jsonb,
  'JSONB criteria_checklist queryable by key'
);

SELECT * FROM finish();
ROLLBACK;
