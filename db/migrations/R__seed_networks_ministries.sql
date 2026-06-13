INSERT INTO ministries.ministry (network_id, code, name, description, target_demographic) VALUES
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'ZOOM_MULTIMEDIA',  'ZOOM - Multimedia',  'Multimedia and media production ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'DAVIDIC_SYNFONIA', 'Davidic Synfonia',   'Worship and music ministry.',               NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'MOVE',             'Move',               'Creative movement and dance ministry.',      NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'GATE_KEEPERS',     'Gate Keepers',       'Prayer and intercession ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'SENTINELS',        'Sentinels',          'Security and ushering ministry.',            NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'FRONTLINERS',      'Frontliners',        'Evangelism and outreach ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'CREATIVES',        'Creatives',          'Graphic design and creative arts ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'PRISM',            'Prism',              'Visual arts and display ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WAVE'), 'SOUNDS',              'Sounds',              'Sound engineering and audio ministry.',  NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WAVE'), 'ILLUMINATION_LIGHTS', 'Illumination - Lights','Lighting and production ministry.',    NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'KINGDOM_KIDS', 'Kingdom Kids', 'Children''s ministry.',                   'Children'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'CCEM',         'CCEM',         'Christian education and curriculum ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'BEST',         'BEST',         'Business and entrepreneurship ministry.',  NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LEAD_TAKERS',  'LeadTakers',   'General leadership development ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LT_YOUTH',     'LT Youth',     'Youth leadership ministry.',               'Youth'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LT_PROWORX',   'Lt ProWorx',   'Professional leadership ministry.',        'Young professionals'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'D8_18',        'D8:18',        'Discipleship 8:18 ministry.',              NULL)
ON CONFLICT (code) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  network_id         = EXCLUDED.network_id,
  target_demographic = EXCLUDED.target_demographic;

-- Ensure each seeded ministry is joinable at the main branch.
INSERT INTO ministries.ministry_chapter (ministry_id, branch_id, status)
SELECT m.ministry_id, b.branch_id, 'ACTIVE'
FROM ministries.ministry m
CROSS JOIN core.branch b
WHERE b.code = 'MAIN'
ON CONFLICT ON CONSTRAINT chapter_ministry_branch_unique DO NOTHING;
