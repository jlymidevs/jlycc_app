BEGIN;
SELECT plan(6);

SELECT has_role('attendance_writer', 'attendance_writer role exists');

-- app_general cannot read PII tables
SET LOCAL ROLE app_general;
PREPARE reg_read AS SELECT registration_id FROM events.event_registration LIMIT 1;
SELECT throws_ok('reg_read', '42501', NULL, 'app_general cannot read event_registration');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE vc_read AS SELECT ftv_capture_id FROM attendance.visitor_capture LIMIT 1;
SELECT throws_ok('vc_read', '42501', NULL, 'app_general cannot read visitor_capture');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE cc_read AS SELECT check_in_id FROM attendance.child_check_in LIMIT 1;
SELECT throws_ok('cc_read', '42501', NULL, 'app_general cannot read child_check_in');
RESET ROLE;

-- app_general CAN read non-PII tables
SET LOCAL ROLE app_general;
PREPARE net_read AS SELECT network_id FROM ministries.network LIMIT 1;
SELECT lives_ok('net_read', 'app_general can read ministries.network');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE evt_read AS SELECT event_id FROM events.event LIMIT 1;
SELECT lives_ok('evt_read', 'app_general can read events.event');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
