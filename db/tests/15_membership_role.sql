BEGIN;
SELECT plan(3);

SELECT has_table('membership', 'role', 'role exists');

-- Confirm Lead Taker is NOT in roles (it's a Network)
SELECT is_empty(
  $$SELECT 1 FROM membership.role WHERE code = 'LEAD_TAKER'$$,
  'LEAD_TAKER correctly absent from roles'
);

SELECT bag_has(
  $$SELECT code FROM membership.role WHERE is_active$$,
  $$VALUES ('PASTOR'),('REGIONAL_DIRECTOR'),('ADMIN_STAFF'),('PCM')$$,
  'core roles present'
);

SELECT * FROM finish();
ROLLBACK;
