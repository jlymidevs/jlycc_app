BEGIN;
SELECT plan(4);

SELECT bag_eq(
  $$SELECT code FROM ministries.network ORDER BY code$$,
  $$VALUES ('EAGLES'),('WAVE'),('WIND')$$,
  'all 3 networks seeded'
);

SELECT bag_eq(
  $$SELECT code FROM ministries.ministry$$,
  $$VALUES ('ZOOM_MULTIMEDIA'),('DAVIDIC_SYNFONIA'),('MOVE'),('GATE_KEEPERS'),
           ('SENTINELS'),('FRONTLINERS'),('CREATIVES'),('PRISM'),
           ('SOUNDS'),('ILLUMINATION_LIGHTS'),
           ('KINGDOM_KIDS'),('CCEM'),('BEST'),('LEAD_TAKERS'),
           ('LT_YOUTH'),('LT_PROWORX'),('D8_18')$$,
  'all 17 ministries seeded'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'MOVE'),
  'WIND',
  'Move belongs to Wind network'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'LT_PROWORX'),
  'EAGLES',
  'Lt ProWorx belongs to Eagles network'
);

SELECT * FROM finish();
ROLLBACK;
