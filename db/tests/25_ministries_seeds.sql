BEGIN;
SELECT plan(4);

SELECT bag_eq(
  $$SELECT code FROM ministries.network ORDER BY code$$,
  $$VALUES ('EAGLES'),('LEAD_TAKERS'),('WIND')$$,
  'all 3 networks seeded'
);

SELECT bag_has(
  $$SELECT code FROM ministries.ministry$$,
  $$VALUES ('MOVE'),('CCEM'),('HARPS_AND_BOWLS'),('KINGDOM_KIDS'),
           ('COUPLES'),('MISSIONS'),
           ('LT_CONNECT'),('LT_YOUTH'),('LT_PRO')$$,
  'all 9 ministries seeded'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'MOVE'),
  'EAGLES',
  'Move belongs to Eagles network'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'LT_PRO'),
  'LEAD_TAKERS',
  'LT Pro belongs to Lead Takers network'
);

SELECT * FROM finish();
ROLLBACK;
