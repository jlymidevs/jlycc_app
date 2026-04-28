CREATE TABLE education.bc_class_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  offering_id    BIGINT NOT NULL REFERENCES education.bc_course_offering(offering_id) ON DELETE CASCADE,
  student_id     BIGINT NOT NULL REFERENCES education.bc_student(student_id) ON DELETE CASCADE,
  class_date     DATE NOT NULL,
  attended       BOOLEAN NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bc_class_attendance_unique UNIQUE (offering_id, student_id, class_date)
);

CREATE INDEX idx_bc_class_att_offering ON education.bc_class_attendance(offering_id);
CREATE INDEX idx_bc_class_att_student ON education.bc_class_attendance(student_id);

COMMENT ON TABLE education.bc_class_attendance IS 'Per-class Bible College attendance. Dedicated tracking (not via events schema).';
