-- app_full: full read/write access
GRANT USAGE ON SCHEMA education TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA education TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA education TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read
GRANT USAGE ON SCHEMA education TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access (no PII tables to revoke in education schema)
GRANT USAGE ON SCHEMA education TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA education TO app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA education
  GRANT SELECT ON TABLES TO app_general;
