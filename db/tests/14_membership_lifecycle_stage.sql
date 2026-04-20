BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'lifecycle_stage', 'lifecycle_stage exists');
SELECT col_is_pk('membership', 'lifecycle_stage', 'stage_code', 'stage_code is PK');

-- Confirm seeds
SELECT bag_eq(
  $$SELECT stage_code FROM membership.lifecycle_stage WHERE is_active$$,
  $$VALUES ('FTV'),('DFL'),('OGV'),('RA'),('REGULAR_MEMBER')$$,
  'all 5 lifecycle stages seeded'
);

SELECT * FROM finish();
ROLLBACK;
