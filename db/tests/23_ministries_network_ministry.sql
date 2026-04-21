BEGIN;
SELECT plan(8);

SELECT has_schema('ministries', 'ministries schema exists');
SELECT has_table('ministries', 'network', 'network table exists');
SELECT has_table('ministries', 'ministry', 'ministry table exists');
SELECT col_is_unique('ministries', 'network', ARRAY['code'], 'network.code is unique');
SELECT col_is_unique('ministries', 'ministry', ARRAY['code'], 'ministry.code is unique');
SELECT has_fk('ministries', 'ministry', 'ministry has FK to network');

INSERT INTO ministries.network (code, name) VALUES ('TEST_NET', 'Test Network')
  RETURNING network_id \gset
INSERT INTO ministries.ministry (network_id, code, name)
  VALUES (:network_id, 'TEST_MIN', 'Test Ministry');
SELECT pass('network + ministry insert succeeds');

SELECT throws_ok(
  $$INSERT INTO ministries.ministry (network_id, code, name) VALUES (999999, 'X', 'X')$$,
  '23503', NULL, 'invalid network_id rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
