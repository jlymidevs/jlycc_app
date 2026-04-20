BEGIN;
SELECT plan(4);

SELECT has_table('membership', 'lifecycle_stage_history', 'history table exists');
SELECT has_table('membership', 'branch_membership_history', 'branch transfer history exists');
SELECT has_fk('membership', 'lifecycle_stage_history', 'FK to member');
SELECT has_fk('membership', 'branch_membership_history', 'FK to member');

SELECT * FROM finish();
ROLLBACK;
