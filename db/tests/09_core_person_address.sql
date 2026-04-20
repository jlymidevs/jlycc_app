BEGIN;
SELECT plan(4);

SELECT has_table('core', 'person_address', 'core.person_address exists');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'B') RETURNING person_id \gset
INSERT INTO core.address (line1, country_code) VALUES ('123 Test', 'PH') RETURNING address_id \gset

INSERT INTO core.person_address (person_id, address_id, type, valid_from)
  VALUES (:person_id, :address_id, 'HOME', CURRENT_DATE);
SELECT pass('insert succeeds');

-- NOTE: Use inline throws_ok($$ ... $$, ...) form — Postgres parses enum
-- literals at PREPARE time, so a PREPARE'd named statement with a bogus enum
-- value errors before throws_ok runs. (See Task 3 / test 05 for the same fix.)
SELECT throws_ok(
  format($$INSERT INTO core.person_address (person_id, address_id, type, valid_from)
             VALUES (%L, %L, 'BOGUS', CURRENT_DATE)$$, :'person_id', :'address_id'),
  '22P02',
  NULL,
  'invalid type rejected'
);

SELECT col_not_null('core', 'person_address', 'valid_from', 'valid_from NOT NULL');

SELECT * FROM finish();
ROLLBACK;
