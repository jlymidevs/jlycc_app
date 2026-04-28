BEGIN;
SELECT plan(17);

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

-- ==================== Plan 2: Operational Layer ====================

-- Create a ministry chapter and assign Juan as leader
INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES ((SELECT ministry_id FROM ministries.ministry WHERE code='MOVE'), :branch_id)
  RETURNING chapter_id \gset

INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
  VALUES (:chapter_id, :jdc_member, now(), true, 'HEAD');

SELECT is(
  (SELECT count(*)::int FROM ministries.ministry_membership
   WHERE chapter_id = :chapter_id AND is_leader = true),
  1,
  'Juan is leader of Move chapter'
);

-- Create an event and check in
INSERT INTO events.event (event_type_id, name, starts_at, branch_id, status)
  VALUES ((SELECT event_type_id FROM events.event_type WHERE code='SUNDAY_SERVICE'),
          'Sunday Service Apr 20', '2026-04-20 09:00:00+08', :branch_id, 'SCHEDULED')
  RETURNING event_id AS svc_event_id \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:svc_event_id, :jdc_id, :branch_id, '2026-04-20 09:10:00+08', 'SELF');
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:svc_event_id, :mdc_id, :branch_id, '2026-04-20 09:12:00+08', 'USHER');

SELECT is(
  (SELECT total_check_ins::int FROM attendance.attendance_summary
   WHERE event_id = :svc_event_id),
  2,
  'attendance summary shows 2 check-ins'
);

-- FTV capture: new visitor at the service
INSERT INTO core.person (first_name, last_name) VALUES ('New', 'Visitor')
  RETURNING person_id AS ftv_pid \gset

INSERT INTO attendance.visitor_capture (person_id, event_id, branch_id, consent_to_contact, intake_notes)
  VALUES (:ftv_pid, :svc_event_id, :branch_id, true, 'Friend of Juan')
  RETURNING ftv_capture_id \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
  VALUES (:svc_event_id, :ftv_pid, :branch_id, '2026-04-20 09:20:00+08', :ftv_capture_id);

SELECT is(
  (SELECT ftv_count::int FROM attendance.attendance_summary
   WHERE event_id = :svc_event_id),
  1,
  'summary counts 1 FTV check-in'
);

-- Child check-in with pickup code
INSERT INTO core.person (first_name, last_name) VALUES ('Kid', 'Dela Cruz')
  RETURNING person_id AS kid_pid \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:svc_event_id, :kid_pid, :branch_id, '2026-04-20 09:05:00+08')
  RETURNING check_in_id AS kid_ci_id, checked_in_at AS kid_ci_at \gset

INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, pickup_code, allergies)
  VALUES (:kid_ci_id, :'kid_ci_at', :svc_event_id, 'MNL-K-9472', 'None');

SELECT pass('child check-in with pickup code succeeds');

-- Event registration for a big event
INSERT INTO events.event (event_type_id, name, starts_at, status)
  VALUES ((SELECT event_type_id FROM events.event_type WHERE code='CAMP_MEETING'),
          'Camp Meeting 2026', '2026-07-01 08:00:00+08', 'SCHEDULED')
  RETURNING event_id AS cm_event_id \gset

INSERT INTO events.event_registration (event_id, person_id, status, group_size, accommodation_required)
  VALUES (:cm_event_id, :jdc_id, 'CONFIRMED', 3, true);

SELECT is(
  (SELECT group_size FROM events.event_registration WHERE event_id = :cm_event_id AND person_id = :jdc_id),
  3,
  'Camp Meeting registration with group_size=3'
);

-- ==================== Plan 3a: Programs + Missions ====================

-- Heartlink: create cohort, enroll Juan, record session attendance
INSERT INTO programs.heartlink_cohort (branch_id, name, facilitator_member_id, status)
  VALUES (:branch_id, 'Manila Heartlink Q1 2026', :jdc_member, 'ACTIVE')
  RETURNING cohort_id AS hl_cohort \gset

INSERT INTO programs.heartlink_enrollment (cohort_id, person_id)
  VALUES (:hl_cohort, :jdc_id) RETURNING enrollment_id AS hl_enroll \gset

INSERT INTO programs.heartlink_session (cohort_id, session_number, topic)
  VALUES (:hl_cohort, 1, 'Identity in Christ') RETURNING session_id AS hl_session \gset

INSERT INTO programs.heartlink_session_attendance (session_id, enrollment_id, attended)
  VALUES (:hl_session, :hl_enroll, true);

SELECT is(
  (SELECT count(*)::int FROM programs.heartlink_session_attendance
   WHERE session_id = :hl_session AND attended = true),
  1,
  'Heartlink session attendance recorded'
);

-- Scholar: award a scholarship to Juan
INSERT INTO missions.scholar_program (name, status) VALUES ('2026 Scholars', 'ACTIVE')
  RETURNING program_id AS scholar_prog \gset

INSERT INTO missions.scholarship_award (program_id, member_id, school_name, amount, status)
  VALUES (:scholar_prog, :jdc_member, 'UP Diliman', 25000, 'ACTIVE');

SELECT is(
  (SELECT school_name FROM missions.scholarship_award WHERE member_id = :jdc_member),
  'UP Diliman',
  'scholarship award with school_name'
);

-- BAC: create initiative, add walk-in attendance
INSERT INTO missions.bac_initiative (branch_id, name, target_community, status)
  VALUES (:branch_id, 'Bless Tondo 2026', 'Tondo, Manila', 'ACTIVE')
  RETURNING initiative_id AS bac_init \gset

INSERT INTO missions.bac_session (initiative_id, session_number, topic)
  VALUES (:bac_init, 1, 'Who is Jesus?') RETURNING session_id AS bac_sess \gset

INSERT INTO missions.bac_session_attendance (session_id, person_id, attended, attended_as)
  VALUES (:bac_sess, :ftv_pid, true, 'WALK_IN');

SELECT is(
  (SELECT attended_as::text FROM missions.bac_session_attendance
   WHERE session_id = :bac_sess AND person_id = :ftv_pid),
  'WALK_IN',
  'BAC walk-in attendance recorded'
);

SELECT pass('programs + missions end-to-end complete');

SELECT * FROM finish();
ROLLBACK;
