-- db/migrations/V064__create_app_schema_users.sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.users IS 'Staff accounts for the web app. Managed by Auth.js — not church membership data.';

-- Create roles if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_writer') THEN
    CREATE ROLE app_writer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reader') THEN
    CREATE ROLE app_reader;
  END IF;
END
$$;

-- Grant to app_writer
GRANT SELECT, INSERT, UPDATE ON app.users TO app_writer;
GRANT SELECT ON app.users TO app_reader;
