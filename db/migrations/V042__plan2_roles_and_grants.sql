-- ============================================================================
-- attendance_writer: check-in kiosk/app role (INSERT/UPDATE only)
-- ============================================================================
CREATE ROLE attendance_writer NOLOGIN;
GRANT USAGE ON SCHEMA attendance TO attendance_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA attendance TO attendance_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA attendance TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT INSERT, UPDATE ON TABLES TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT USAGE, SELECT ON SEQUENCES TO attendance_writer;

-- attendance_writer needs SELECT on referenced tables for FK validation
GRANT USAGE ON SCHEMA events, core, membership TO attendance_writer;
GRANT SELECT ON events.event TO attendance_writer;
GRANT SELECT ON core.person, core.branch TO attendance_writer;
GRANT SELECT ON membership.member TO attendance_writer;

-- ============================================================================
-- Extend existing roles for new schemas
-- ============================================================================

-- app_full: full read/write access
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ministries, events, attendance TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read including PII
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access excluding PII tables
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_general;
REVOKE SELECT ON events.event_registration FROM app_general;
REVOKE SELECT ON attendance.visitor_capture FROM app_general;
REVOKE SELECT ON attendance.child_check_in FROM app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_general;
