BEGIN;
SELECT plan(4);

SELECT has_table('core', 'kinship', 'core.kinship exists');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id AS a_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'X') RETURNING person_id AS b_id \gset

INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:a_id, :b_id, 'SPOUSE', CURRENT_DATE);
SELECT pass('spouse link inserted');

PREPARE self_link AS
  INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:a_id, :a_id, 'SPOUSE', CURRENT_DATE);
SELECT throws_ok('self_link', '23514', NULL, 'self-kinship rejected by check constraint');

SELECT col_not_null('core', 'kinship', 'relationship', 'relationship NOT NULL');

SELECT * FROM finish();
ROLLBACK;
