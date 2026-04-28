CREATE TABLE education.isu_track_progression (
  progression_id  BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES education.isu_student(student_id) ON DELETE CASCADE,
  from_track_id   BIGINT REFERENCES education.isu_track(track_id),
  to_track_id     BIGINT NOT NULL REFERENCES education.isu_track(track_id),
  progressed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_progression_student ON education.isu_track_progression(student_id);

COMMENT ON TABLE education.isu_track_progression IS 'ISU track progression history. from_track_id is NULL for initial enrollment.';

CREATE TABLE education.isu_session (
  session_id             BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  track_id               BIGINT NOT NULL REFERENCES education.isu_track(track_id),
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_session_branch ON education.isu_session(branch_id);
CREATE INDEX idx_isu_session_track ON education.isu_session(track_id);

CREATE TRIGGER trg_isu_session_updated_at
  BEFORE UPDATE ON education.isu_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_session IS 'ISU teaching session. Per-branch, per-track.';

CREATE TABLE education.isu_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES education.isu_session(session_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  attended       BOOLEAN NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT isu_session_attendance_unique UNIQUE (session_id, person_id)
);

CREATE INDEX idx_isu_attendance_person ON education.isu_session_attendance(person_id);

COMMENT ON TABLE education.isu_session_attendance IS 'ISU per-session attendance. Uses person_id (not student_id) — anyone can attend.';
