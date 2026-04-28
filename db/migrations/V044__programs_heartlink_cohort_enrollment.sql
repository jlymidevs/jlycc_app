CREATE TYPE programs.cohort_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE programs.enrollment_status AS ENUM ('ENROLLED', 'ACTIVE', 'COMPLETED', 'DROPPED');

CREATE TABLE programs.heartlink_cohort (
  cohort_id              BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                   TEXT NOT NULL,
  starts_on              DATE,
  ends_on                DATE,
  session_count          INT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  status                 programs.cohort_status NOT NULL DEFAULT 'PLANNING',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartlink_cohort_branch ON programs.heartlink_cohort(branch_id);
CREATE INDEX idx_heartlink_cohort_status ON programs.heartlink_cohort(status);

CREATE TRIGGER trg_heartlink_cohort_updated_at
  BEFORE UPDATE ON programs.heartlink_cohort
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_cohort IS 'Heartlink discipleship cohort instance (e.g., "Manila Heartlink Q1 2026").';

CREATE TABLE programs.heartlink_enrollment (
  enrollment_id  BIGSERIAL PRIMARY KEY,
  cohort_id      BIGINT NOT NULL REFERENCES programs.heartlink_cohort(cohort_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         programs.enrollment_status NOT NULL DEFAULT 'ENROLLED',
  completion_date DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT heartlink_enrollment_unique UNIQUE (cohort_id, person_id)
);

CREATE INDEX idx_heartlink_enrollment_person ON programs.heartlink_enrollment(person_id);

CREATE TRIGGER trg_heartlink_enrollment_updated_at
  BEFORE UPDATE ON programs.heartlink_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE programs.heartlink_enrollment IS 'Person ↔ Heartlink cohort. Uses person_id so non-members can enroll.';
