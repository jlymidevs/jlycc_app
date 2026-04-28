CREATE TABLE programs.heartlink_session (
  session_id             BIGSERIAL PRIMARY KEY,
  cohort_id              BIGINT NOT NULL REFERENCES programs.heartlink_cohort(cohort_id) ON DELETE CASCADE,
  session_number         INT NOT NULL,
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  duration_minutes       INT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  venue                  TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartlink_session_cohort ON programs.heartlink_session(cohort_id);

CREATE TRIGGER trg_heartlink_session_updated_at
  BEFORE UPDATE ON programs.heartlink_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_session IS 'Session within a Heartlink cohort.';

CREATE TABLE programs.heartlink_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES programs.heartlink_session(session_id) ON DELETE CASCADE,
  enrollment_id  BIGINT NOT NULL REFERENCES programs.heartlink_enrollment(enrollment_id) ON DELETE CASCADE,
  attended       BOOLEAN NOT NULL,
  arrived_at     TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT heartlink_attendance_unique UNIQUE (session_id, enrollment_id)
);

CREATE INDEX idx_heartlink_attendance_enrollment ON programs.heartlink_session_attendance(enrollment_id);

COMMENT ON TABLE programs.heartlink_session_attendance IS 'Per-session Heartlink attendance. Links to enrollment (must be enrolled to track attendance).';
