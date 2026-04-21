CREATE VIEW attendance.attendance_summary AS
SELECT
  c.event_id,
  c.branch_id,
  date_trunc('week', c.checked_in_at)::date AS week_start,
  count(*) AS total_check_ins,
  count(DISTINCT c.person_id) AS unique_persons,
  count(c.ftv_capture_id) AS ftv_count
FROM attendance.check_in c
GROUP BY c.event_id, c.branch_id, date_trunc('week', c.checked_in_at)::date;

COMMENT ON VIEW attendance.attendance_summary IS 'Weekly attendance aggregates by event and branch. Regular view; convert to materialized when dashboard performance demands it.';
