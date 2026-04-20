-- ============================================================================
-- Database roles for application access
-- ============================================================================
-- These are NOLOGIN roles; the actual app DB users (created out-of-band) GRANT
-- one of these. In Cloud SQL, create the connecting user with cloudsql_iam or
-- a password, then GRANT app_general | app_pastoral | app_full TO <user>.

CREATE ROLE app_general NOLOGIN;
CREATE ROLE app_pastoral NOLOGIN;
CREATE ROLE app_full NOLOGIN;

-- ----------------------------------------------------------------------------
-- app_full: full read/write access (used by main backend)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA core, membership TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, membership TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- ----------------------------------------------------------------------------
-- app_pastoral: full read incl. PII
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA core, membership TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT SELECT ON TABLES TO app_pastoral;

-- ----------------------------------------------------------------------------
-- app_general: read access EXCLUDING PII tables and PII columns
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core, membership TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA core, membership TO app_general;

-- Revoke entirely on PII tables
REVOKE SELECT ON core.contact_info FROM app_general;
REVOKE SELECT ON core.address FROM app_general;
REVOKE SELECT ON core.person_address FROM app_general;

-- Column-level: revoke specific PII columns on core.person
REVOKE SELECT (date_of_birth, notes) ON core.person FROM app_general;

-- Apply default privileges so future tables in these schemas are also restricted.
ALTER DEFAULT PRIVILEGES IN SCHEMA core, membership
  GRANT SELECT ON TABLES TO app_general;
