CREATE TABLE attendance.visitor_capture (
  ftv_capture_id        BIGSERIAL PRIMARY KEY,
  person_id             BIGINT NOT NULL REFERENCES core.person(person_id),
  event_id              BIGINT NOT NULL REFERENCES events.event(event_id),
  branch_id             BIGINT NOT NULL REFERENCES core.branch(branch_id),
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by_member_id BIGINT REFERENCES membership.member(member_id),
  invited_by_person_id  BIGINT REFERENCES core.person(person_id),
  consent_to_contact    BOOLEAN NOT NULL DEFAULT false,
  intake_notes          TEXT,
  converted_member_id   BIGINT REFERENCES membership.member(member_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitor_capture_person ON attendance.visitor_capture(person_id);
CREATE INDEX idx_visitor_capture_event ON attendance.visitor_capture(event_id);
CREATE INDEX idx_visitor_capture_branch ON attendance.visitor_capture(branch_id);

COMMENT ON COLUMN attendance.visitor_capture.intake_notes IS 'PII';
COMMENT ON TABLE attendance.visitor_capture IS 'FTV intake form. Links a new person to the event where they were first captured. PII: intake_notes.';

-- Add FK on check_in.ftv_capture_id now that visitor_capture exists
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_ftv_capture_fk
  FOREIGN KEY (ftv_capture_id) REFERENCES attendance.visitor_capture(ftv_capture_id);
