BEGIN;
SELECT plan(4);

SELECT bag_eq(
  $$SELECT category_code FROM events.event_category ORDER BY category_code$$,
  $$VALUES ('REGULAR'),('SEASONAL')$$,
  'both event categories seeded'
);

SELECT is(
  (SELECT count(*)::int FROM events.event_type),
  15,
  '15 event types seeded'
);

SELECT is(
  (SELECT n.code FROM events.event_type et
   JOIN ministries.network n ON n.network_id = et.network_id
   WHERE et.code = 'LT_CONNECT'),
  'LEAD_TAKERS',
  'LT_CONNECT linked to Lead Takers network'
);

SELECT is(
  (SELECT m.code FROM events.event_type et
   JOIN ministries.ministry m ON m.ministry_id = et.ministry_id
   WHERE et.code = 'KINGDOM_KIDS'),
  'KINGDOM_KIDS',
  'KINGDOM_KIDS event type linked to Kingdom Kids ministry'
);

SELECT * FROM finish();
ROLLBACK;
