BEGIN;
SELECT plan(2);

SELECT has_function(
  'public', 'set_updated_at',
  ARRAY[]::text[],
  'set_updated_at trigger function exists'
);

SELECT has_function(
  'public', 'record_history',
  ARRAY[]::text[],
  'record_history trigger function exists'
);

SELECT * FROM finish();
ROLLBACK;
