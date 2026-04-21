BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_organizer', 'organizer table exists');
SELECT has_table('events', 'event_registration', 'registration table exists');

INSERT INTO events.event_category (category_code, name) VALUES ('SEASONAL', 'Seasonal');
INSERT INTO events.event_type (code, name, category_code) VALUES ('CM', 'Camp Meeting', 'SEASONAL')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Camp Meeting 2026', now()) RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO events.event_organizer (event_id, member_id, role)
  VALUES (:event_id, :member_id, 'Lead Coordinator');
SELECT pass('organizer insert succeeds');

PREPARE dup_org AS
  INSERT INTO events.event_organizer (event_id, member_id, role)
  VALUES (:event_id, :member_id, 'Another Role');
SELECT throws_ok('dup_org', '23505', NULL, 'duplicate (event, member) organizer rejected');

INSERT INTO events.event_registration (event_id, person_id, status, group_size)
  VALUES (:event_id, :person_id, 'REGISTERED', 2);
SELECT pass('registration insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event_registration (event_id, person_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid registration_status rejected'
);

SELECT col_not_null('events', 'event_registration', 'event_id', 'event_id NOT NULL');

SELECT * FROM finish();
ROLLBACK;
