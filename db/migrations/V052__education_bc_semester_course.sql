CREATE TABLE education.bc_semester (
  semester_id   BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  academic_year TEXT,
  term_number   INT,
  starts_on     DATE,
  ends_on       DATE,
  status        education.semester_status NOT NULL DEFAULT 'PLANNED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_semester_status ON education.bc_semester(status);

CREATE TRIGGER trg_bc_semester_updated_at
  BEFORE UPDATE ON education.bc_semester
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_semester IS 'Academic semester. Shared across all programs.';

CREATE TABLE education.bc_course (
  course_id    BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  credits      INT,
  description  TEXT,
  department   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_bc_course_updated_at
  BEFORE UPDATE ON education.bc_course
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_course IS 'Bible College course catalog entry (e.g., "THE101 Introduction to Theology").';
