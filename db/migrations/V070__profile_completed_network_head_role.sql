-- One-time welcome flag, city/province-only addresses, NETWORK_HEAD role.

ALTER TABLE app.users ADD COLUMN profile_completed_at TIMESTAMPTZ;
COMMENT ON COLUMN app.users.profile_completed_at IS
  'Set when the member finishes the /welcome step. NULL = show /welcome.';

-- /me/profile saves city/province + country only; line1 becomes optional.
ALTER TABLE core.address ALTER COLUMN line1 DROP NOT NULL;

ALTER TABLE app.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE app.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','NETWORK_HEAD','MINISTRY_HEAD','MEMBER'));

-- Existing members with a provisioned person already passed the welcome
-- step (or signed up via the credentials form, which collects the same
-- fields) — never show them /welcome again.
UPDATE app.users SET profile_completed_at = now()
  WHERE role = 'MEMBER' AND person_id IS NOT NULL;
