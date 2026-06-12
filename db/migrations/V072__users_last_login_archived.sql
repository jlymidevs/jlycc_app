-- V072: last_login_at tracks most recent auth; archived_at is soft-delete
ALTER TABLE app.users
  ADD COLUMN last_login_at TIMESTAMPTZ,
  ADD COLUMN archived_at  TIMESTAMPTZ;

CREATE INDEX idx_users_archived ON app.users (archived_at)
  WHERE archived_at IS NOT NULL;
