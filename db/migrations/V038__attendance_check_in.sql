CREATE TYPE attendance.check_in_method AS ENUM ('SELF', 'USHER', 'BULK_IMPORT');

CREATE TABLE attendance.check_in (
  check_in_id          BIGSERIAL,
  event_id             BIGINT NOT NULL,
  person_id            BIGINT NOT NULL,
  branch_id            BIGINT NOT NULL,
  checked_in_at        TIMESTAMPTZ NOT NULL,
  check_in_method      attendance.check_in_method NOT NULL DEFAULT 'USHER',
  captured_by_member_id BIGINT,
  ftv_capture_id       BIGINT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (check_in_id, checked_in_at)
) PARTITION BY RANGE (checked_in_at);

ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_event_fk FOREIGN KEY (event_id) REFERENCES events.event(event_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_person_fk FOREIGN KEY (person_id) REFERENCES core.person(person_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_branch_fk FOREIGN KEY (branch_id) REFERENCES core.branch(branch_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_captured_by_fk FOREIGN KEY (captured_by_member_id) REFERENCES membership.member(member_id);

CREATE INDEX idx_check_in_event ON attendance.check_in(event_id);
CREATE INDEX idx_check_in_person ON attendance.check_in(person_id, checked_in_at DESC);
CREATE INDEX idx_check_in_branch ON attendance.check_in(branch_id, checked_in_at DESC);

CREATE TABLE attendance.check_in_2026_04 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE attendance.check_in_2026_05 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

COMMENT ON TABLE attendance.check_in IS 'Per-person check-in. Partitioned by month on checked_in_at. Uses person_id (not member_id) so FTVs work.';
