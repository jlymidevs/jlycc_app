BEGIN;
SELECT plan(4);

SELECT has_table('core', 'household_member', 'core.household_member exists');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Head', 'X') RETURNING person_id \gset
INSERT INTO core.household (branch_id, name) VALUES (:branch_id, 'X Family') RETURNING household_id \gset

INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :person_id, 'HEAD', now());
SELECT pass('insert succeeds');

PREPARE dup AS
  INSERT INTO core.household_member (household_id, person_id, role_in_household, joined_at)
  VALUES (:household_id, :person_id, 'HEAD', now());
SELECT throws_ok('dup', '23505', NULL, 'duplicate (household, person, joined_at) rejected');

SELECT col_not_null('core', 'household_member', 'role_in_household', 'role NOT NULL');

SELECT * FROM finish();
ROLLBACK;
