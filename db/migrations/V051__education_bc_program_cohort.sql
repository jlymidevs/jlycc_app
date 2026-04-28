CREATE TABLE education.bc_program (
  program_id     BIGSERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  degree_level   TEXT,
  total_credits  INT,
  duration_years INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_bc_program_updated_at
  BEFORE UPDATE ON education.bc_program
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_program IS 'Bible College academic program (e.g., "Bachelor of Theology").';

CREATE TABLE education.bc_cohort (
  cohort_id              BIGSERIAL PRIMARY KEY,
  program_id             BIGINT NOT NULL REFERENCES education.bc_program(program_id),
  name                   TEXT NOT NULL,
  starts_on              DATE,
  expected_graduation_on DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_cohort_program ON education.bc_cohort(program_id);

CREATE TRIGGER trg_bc_cohort_updated_at
  BEFORE UPDATE ON education.bc_cohort
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_cohort IS 'Bible College cohort (e.g., "BT Class of 2028").';
