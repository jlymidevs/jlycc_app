BEGIN;
SELECT plan(6);

SELECT has_schema('education', 'education schema exists');
SELECT has_table('education', 'school', 'school table exists');

-- Seed data
SELECT is(
  (SELECT count(*)::int FROM education.school),
  2,
  'two schools seeded'
);

SELECT is(
  (SELECT name FROM education.school WHERE code = 'BIBLE_COLLEGE'),
  'Bible College',
  'BIBLE_COLLEGE seeded correctly'
);

-- Enum validation
SELECT throws_ok(
  $$INSERT INTO education.school (code, name, status) VALUES ('X', 'X', 'BOGUS')$$,
  '22P02', NULL, 'invalid school_status rejected'
);

-- Unique code
PREPARE dup_school AS INSERT INTO education.school (code, name) VALUES ('BIBLE_COLLEGE', 'Dup');
SELECT throws_ok('dup_school', '23505', NULL, 'duplicate school code rejected');

SELECT * FROM finish();
ROLLBACK;
