INSERT INTO ministries.network (code, name, description) VALUES
  ('WIND',   'Wind',   'Wind network — multimedia, worship arts, creative and outreach.'),
  ('WAVE',   'Wave',   'Wave network — sound and lighting production.'),
  ('EAGLES', 'Eagles', 'Eagles network — children, education, leadership and development.')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;
