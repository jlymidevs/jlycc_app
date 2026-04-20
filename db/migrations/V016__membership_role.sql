CREATE TABLE membership.role (
  role_id     BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_pastoral BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership.role IS 'Lookup of stackable roles a member can hold. Lead Taker is NOT here — it is a Network in the ministries schema.';
