BEGIN;
SELECT plan(7);

SELECT has_table('education', 'bc_course_offering', 'bc_course_offering table exists');
SELECT has_fk('education', 'bc_course_offering', 'bc_course_offering has FK');

-- Setup
INSERT INTO education.bc_semester (name, academic_year, term_number)
  VALUES ('1st Sem 2024-2025', '2024-2025', 1)
  RETURNING semester_id \gset
INSERT INTO education.bc_course (code, title, credits)
  VALUES ('THE101', 'Intro to Theology', 3)
  RETURNING course_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('I', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO education.bc_course_offering
  (course_id, semester_id, instructor_member_id, max_seats, schedule, venue)
  VALUES (:course_id, :semester_id, :member_id, 40,
          '{"day":"Monday","time":"09:00","room":"A101"}'::jsonb, 'Room A101')
  RETURNING offering_id \gset
SELECT pass('bc_course_offering insert succeeds');

-- JSONB queryable
SELECT is(
  (SELECT schedule->>'day' FROM education.bc_course_offering WHERE offering_id = :offering_id),
  'Monday',
  'schedule JSONB queryable by key'
);

-- Unique (course_id, semester_id)
PREPARE dup_offering AS
  INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:course_id, :semester_id);
SELECT throws_ok('dup_offering', '23505', NULL, 'duplicate (course, semester) rejected');

-- FK violation
PREPARE bad_offering_fk AS
  INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (999999, :semester_id);
SELECT throws_ok('bad_offering_fk', '23503', NULL, 'invalid course_id FK rejected');

-- Default schedule
INSERT INTO education.bc_course (code, title) VALUES ('THE102', 'Theology 2') RETURNING course_id AS c2 \gset
INSERT INTO education.bc_course_offering (course_id, semester_id)
  VALUES (:c2, :semester_id) RETURNING offering_id AS o2 \gset
SELECT is(
  (SELECT schedule FROM education.bc_course_offering WHERE offering_id = :o2),
  '{}'::jsonb,
  'schedule defaults to empty JSONB object'
);

SELECT * FROM finish();
ROLLBACK;
