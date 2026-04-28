CREATE TABLE education.bc_student (
  student_id     BIGSERIAL PRIMARY KEY,
  person_id      BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  cohort_id      BIGINT NOT NULL REFERENCES education.bc_cohort(cohort_id),
  student_number TEXT NOT NULL UNIQUE,
  enrolled_on    DATE NOT NULL,
  status         education.bc_student_status NOT NULL DEFAULT 'ACTIVE',
  graduated_on   DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bc_student_cohort ON education.bc_student(cohort_id);
CREATE INDEX idx_bc_student_status ON education.bc_student(status);

CREATE TRIGGER trg_bc_student_updated_at
  BEFORE UPDATE ON education.bc_student
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_student IS 'Bible College student. person_id UNIQUE (one student record per person). No branch_id — derived from person/member record.';
