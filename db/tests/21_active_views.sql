BEGIN;
SELECT plan(4);

SELECT has_view('core', 'person_active', 'core.person_active view exists');
SELECT has_view('core', 'household_active', 'core.household_active view exists');
SELECT has_view('membership', 'member_active', 'membership.member_active view exists');

INSERT INTO core.person (first_name, last_name) VALUES ('Live', 'X') RETURNING person_id AS live_id \gset
INSERT INTO core.person (first_name, last_name, deleted_at) VALUES ('Dead', 'Y', now()) RETURNING person_id AS dead_id \gset

SELECT bag_eq(
  $$SELECT person_id FROM core.person_active WHERE last_name IN ('X','Y')$$,
  format($$VALUES (%L::bigint)$$, :live_id),
  'person_active excludes soft-deleted rows'
);

SELECT * FROM finish();
ROLLBACK;
