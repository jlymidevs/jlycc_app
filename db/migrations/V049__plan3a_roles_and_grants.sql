-- app_full: full read/write access
GRANT USAGE ON SCHEMA programs, missions TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA programs, missions TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA programs, missions TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read
GRANT USAGE ON SCHEMA programs, missions TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access (no PII tables to revoke in these schemas)
GRANT USAGE ON SCHEMA programs, missions TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA programs, missions TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA programs, missions
  GRANT SELECT ON TABLES TO app_general;
