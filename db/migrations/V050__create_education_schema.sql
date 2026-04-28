CREATE SCHEMA IF NOT EXISTS education;
COMMENT ON SCHEMA education IS 'Bible College and ISU (International Success University) education tracking.';

CREATE TYPE education.school_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE education.semester_status AS ENUM ('PLANNED', 'REGISTRATION', 'ACTIVE', 'GRADING', 'CLOSED');
CREATE TYPE education.bc_student_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'GRADUATED', 'WITHDRAWN', 'DISMISSED');
CREATE TYPE education.bc_enrollment_status AS ENUM ('ENROLLED', 'DROPPED', 'COMPLETED', 'WITHDRAWN');
CREATE TYPE education.bc_completion_status AS ENUM ('COMPLETED', 'INCOMPLETE', 'WITHDRAWN');
CREATE TYPE education.isu_student_status AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED');

CREATE TABLE education.school (
  school_id    BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  founded_on   DATE,
  status       education.school_status NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_school_updated_at
  BEFORE UPDATE ON education.school
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.school IS 'School lookup. Seeded: BIBLE_COLLEGE, ISU.';
