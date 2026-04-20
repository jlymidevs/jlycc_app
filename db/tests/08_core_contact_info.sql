BEGIN;
SELECT plan(8);

SELECT has_table('core', 'contact_info', 'core.contact_info exists');
SELECT has_fk('core', 'contact_info', 'FK to person');
SELECT col_not_null('core', 'contact_info', 'value', 'value NOT NULL');

INSERT INTO core.person (first_name, last_name) VALUES ('A', 'B') RETURNING person_id \gset
INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'EMAIL', 'a@b.com', true);
SELECT pass('email insert');

INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'MOBILE', '+639171234567', true);
SELECT pass('mobile insert');

SELECT throws_ok(
  $$INSERT INTO core.contact_info (person_id, type, value, is_primary)
    VALUES (1, 'BOGUS', 'x', false)$$,
  '22P02', NULL, 'invalid contact_type rejected'
);

PREPARE dup_primary AS
  INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'EMAIL', 'second@b.com', true);
SELECT throws_ok('dup_primary', '23505', NULL, 'duplicate primary per (person, type) rejected');

INSERT INTO core.contact_info (person_id, type, value, is_primary)
  VALUES (:person_id, 'EMAIL', 'second@b.com', false);
SELECT pass('non-primary duplicate email allowed');

SELECT * FROM finish();
ROLLBACK;
