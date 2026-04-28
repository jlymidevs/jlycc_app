INSERT INTO education.school (code, name, description) VALUES
  ('BIBLE_COLLEGE', 'Bible College', 'JLY Bible College — formal academic structure.'),
  ('ISU', 'International Success University', 'ISU — continuous track-based discipleship.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
