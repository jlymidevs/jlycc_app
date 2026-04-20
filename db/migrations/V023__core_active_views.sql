CREATE VIEW core.person_active AS
  SELECT * FROM core.person WHERE deleted_at IS NULL;

CREATE VIEW core.household_active AS
  SELECT * FROM core.household WHERE deleted_at IS NULL;

COMMENT ON VIEW core.person_active IS 'core.person filtered to non-deleted rows. Use this in operational queries.';
COMMENT ON VIEW core.household_active IS 'core.household filtered to non-deleted rows.';
