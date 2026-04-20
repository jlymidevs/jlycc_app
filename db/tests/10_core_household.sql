BEGIN;
SELECT plan(5);

SELECT has_table('core', 'household', 'core.household exists');
SELECT has_fk('core', 'household', 'FK to branch');

INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Head', 'X') RETURNING person_id \gset

INSERT INTO core.household (branch_id, name, head_of_household_id)
  VALUES (:branch_id, 'The X Family', :person_id);
SELECT pass('household insert succeeds');

SELECT col_not_null('core', 'household', 'name', 'name NOT NULL');
SELECT col_not_null('core', 'household', 'branch_id', 'branch_id NOT NULL');

SELECT * FROM finish();
ROLLBACK;
