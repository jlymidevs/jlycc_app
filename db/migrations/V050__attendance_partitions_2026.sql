-- db/migrations/V050__attendance_partitions_2026.sql
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_06 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_07 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_08 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_09 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_10 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_11 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS attendance.check_in_2026_12 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
