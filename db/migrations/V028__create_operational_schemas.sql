CREATE SCHEMA IF NOT EXISTS ministries;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS attendance;

COMMENT ON SCHEMA ministries IS 'Ministry hierarchy: Network → Ministry → Branch Chapter → Membership.';
COMMENT ON SCHEMA events IS 'Event management: types, series, instances, organizers, registration.';
COMMENT ON SCHEMA attendance IS 'Check-in tracking, FTV intake, child safety. check_in is partitioned by month.';
