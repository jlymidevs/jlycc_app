INSERT INTO events.event_category (category_code, name) VALUES
  ('SEASONAL', 'Seasonal'),
  ('REGULAR',  'Regular')
ON CONFLICT (category_code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO events.event_type (code, name, category_code, network_id, ministry_id, typical_duration_minutes) VALUES
  ('SUNDAY_SERVICE',  'Sunday Service',             'REGULAR',  NULL, NULL, 120),
  ('FRIDAY_PRAYER',   'Friday Prayer Meeting',      'REGULAR',  NULL, NULL, 90),
  ('GNY',             'Grand New Year',             'SEASONAL', NULL, NULL, 180),
  ('CAMP_MEETING',    'Camp Meeting',               'SEASONAL', NULL, NULL, NULL),
  ('APC',             'Annual Pastors Conference',  'SEASONAL', NULL, NULL, NULL),
  ('MID_YEAR_PC',     'Mid-Year Pastors Conference','SEASONAL', NULL, NULL, NULL),
  ('ANNIVERSARY',     'Church Anniversary',         'SEASONAL', NULL, NULL, 180),
  ('CHRISTMAS',       'Christmas Celebration',      'SEASONAL', NULL, NULL, 180),
  ('COUPLES',         'Couples Event',              'SEASONAL',
    NULL,
    NULL, 120),
  ('MISSIONS_MONTH',  'Missions Month',             'SEASONAL',
    (SELECT network_id FROM ministries.network WHERE code='WIND'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='FRONTLINERS'), NULL),
  ('LT_CONNECT',      'LT Connect',                'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LEAD_TAKERS'), 90),
  ('KINGDOM_KIDS',    'Kingdom Kids',               'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='KINGDOM_KIDS'), 90),
  ('LT_YOUTH',        'LT Youth',                  'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LT_YOUTH'), 90),
  ('LT_PRO',          'LT Pro',                    'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LT_PROWORX'), 90),
  ('HARPS_AND_BOWLS', 'Harps and Bowls',            'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='WIND'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='DAVIDIC_SYNFONIA'), 90)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category_code = EXCLUDED.category_code,
  network_id = EXCLUDED.network_id,
  ministry_id = EXCLUDED.ministry_id,
  typical_duration_minutes = EXCLUDED.typical_duration_minutes;
