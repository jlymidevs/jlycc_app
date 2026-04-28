CREATE TABLE education.bc_course_offering (
  offering_id            BIGSERIAL PRIMARY KEY,
  course_id              BIGINT NOT NULL REFERENCES education.bc_course(course_id),
  semester_id            BIGINT NOT NULL REFERENCES education.bc_semester(semester_id),
  instructor_member_id   BIGINT REFERENCES membership.member(member_id),
  max_seats              INT,
  schedule               JSONB NOT NULL DEFAULT '{}',
  venue                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_offering_course_semester_unique UNIQUE (course_id, semester_id)
);

CREATE INDEX idx_bc_offering_semester ON education.bc_course_offering(semester_id);

CREATE TRIGGER trg_bc_offering_updated_at
  BEFORE UPDATE ON education.bc_course_offering
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_course_offering IS 'Course offered in a specific semester. schedule JSONB is app-interpreted.';
