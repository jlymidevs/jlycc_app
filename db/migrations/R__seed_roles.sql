INSERT INTO membership.role (code, name, description, is_pastoral) VALUES
  ('PASTOR',            'Pastor',                'Pastoral leadership.',                       true),
  ('REGIONAL_DIRECTOR', 'Regional Director',     'Oversees a region cluster.',                 true),
  ('ADMIN_STAFF',       'Admin Staff',           'Administrative role.',                       false),
  ('PCM',               'Pastoral Care Ministry','Provides pastoral care to assigned members.',true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_pastoral = EXCLUDED.is_pastoral;
