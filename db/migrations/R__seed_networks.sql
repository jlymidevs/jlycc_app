INSERT INTO ministries.network (code, name, description) VALUES
  ('EAGLES',       'Eagles',       'Eagles network — worship, creative arts, children.'),
  ('WIND',         'Wind',         'Wind network — couples, missions.'),
  ('LEAD_TAKERS',  'Lead Takers',  'Lead Takers network — leadership development.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
