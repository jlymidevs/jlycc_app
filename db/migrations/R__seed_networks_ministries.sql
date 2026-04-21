INSERT INTO ministries.ministry (network_id, code, name, description, target_demographic) VALUES
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'MOVE', 'Move', 'Creative movement and dance ministry.', 'Young adults'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'CCEM', 'CCEM', 'Creative and communications ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'HARPS_AND_BOWLS', 'Harps and Bowls', 'Worship and intercession ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'KINGDOM_KIDS', 'Kingdom Kids', 'Children''s ministry.', 'Children'),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'),
    'COUPLES', 'Couples Ministry', 'Ministry for married couples.', 'Married couples'),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'),
    'MISSIONS', 'Missions', 'Local and international missions.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_CONNECT', 'LT Connect', 'Leadership connection groups.', 'Leaders'),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_YOUTH', 'LT Youth', 'Youth leadership development.', 'Youth'),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_PRO', 'LT Pro', 'Professional leadership development.', 'Young professionals')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  network_id = EXCLUDED.network_id,
  target_demographic = EXCLUDED.target_demographic;
