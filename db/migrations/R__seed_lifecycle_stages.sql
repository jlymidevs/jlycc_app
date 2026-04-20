INSERT INTO membership.lifecycle_stage (stage_code, name, description, order_index, is_terminal) VALUES
  ('FTV',            'First Time Visitor',  'Someone who has attended at least once.', 10, false),
  ('OGV',            'Ongoing Visitor',     'Visits intermittently but not weekly.',   20, false),
  ('RA',             'Regular Attendee',    'Attends regularly; not yet a member.',    30, false),
  ('REGULAR_MEMBER', 'Regular Member',      'Has met membership criteria.',            40, false),
  ('DFL',            'Drop From List',      'Not interested or no longer pursued.',    99, true)
ON CONFLICT (stage_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  is_terminal = EXCLUDED.is_terminal;
