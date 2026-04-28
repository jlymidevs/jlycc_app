CREATE TABLE education.bc_enrollment (
  enrollment_id  BIGSERIAL PRIMARY KEY,
  student_id     BIGINT NOT NULL REFERENCES education.bc_student(student_id) ON DELETE CASCADE,
  offering_id    BIGINT NOT NULL REFERENCES education.bc_course_offering(offering_id) ON DELETE CASCADE,
  enrolled_on    DATE NOT NULL,
  status         education.bc_enrollment_status NOT NULL DEFAULT 'ENROLLED',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_enrollment_student_offering_unique UNIQUE (student_id, offering_id)
);

CREATE INDEX idx_bc_enrollment_offering ON education.bc_enrollment(offering_id);

CREATE TRIGGER trg_bc_enrollment_updated_at
  BEFORE UPDATE ON education.bc_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.bc_enrollment IS 'Student enrollment in a course offering.';

CREATE TABLE education.bc_completion (
  enrollment_id    BIGINT PRIMARY KEY REFERENCES education.bc_enrollment(enrollment_id),
  status           education.bc_completion_status NOT NULL,
  completed_on     DATE,
  attendance_rate  NUMERIC,
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE education.bc_completion IS 'Completion record for a course enrollment. 1:1 with bc_enrollment. No letter grades, no GPA — attendance rate only.';
