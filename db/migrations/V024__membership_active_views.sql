CREATE VIEW membership.member_active AS
  SELECT * FROM membership.member WHERE deleted_at IS NULL;

COMMENT ON VIEW membership.member_active IS 'membership.member filtered to non-deleted rows.';
