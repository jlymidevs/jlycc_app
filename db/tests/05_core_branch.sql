BEGIN;
SELECT plan(8);

SELECT has_table('core', 'branch', 'core.branch table exists');
SELECT has_pk('core', 'branch', 'core.branch has a primary key');
SELECT col_is_unique('core', 'branch', ARRAY['code'], 'branch.code is unique');
SELECT col_not_null('core', 'branch', 'name', 'name is NOT NULL');
SELECT col_not_null('core', 'branch', 'region_id', 'region_id is NOT NULL');
SELECT has_fk('core', 'branch', 'branch has FK on region_id');

INSERT INTO core.region (code, name, type) VALUES ('TEST', 'Test Region', 'LOCAL_CLUSTER');
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone, status)
  VALUES ('MNL-HQ', 'Manila HQ', (SELECT region_id FROM core.region WHERE code='TEST'),
          'LOCAL', 'PH', 'Asia/Manila', 'ACTIVE');
SELECT pass('insert succeeds');

SELECT throws_ok(
  $$INSERT INTO core.branch (code, name, region_id, type, country_code, timezone, status)
      VALUES ('XXX', 'X', (SELECT region_id FROM core.region WHERE code='TEST'),
              'LOCAL', 'PH', 'Asia/Manila', 'BOGUS')$$,
  '22P02',
  NULL,
  'invalid status rejected'
);

SELECT * FROM finish();
ROLLBACK;
