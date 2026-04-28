CREATE TABLE education.isu_track (
  track_id     BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  order_index  INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_isu_track_updated_at
  BEFORE UPDATE ON education.isu_track
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_track IS 'ISU learning track. Ordered by order_index for progression.';

CREATE TABLE education.isu_student (
  student_id       BIGSERIAL PRIMARY KEY,
  person_id        BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  current_track_id BIGINT REFERENCES education.isu_track(track_id),
  enrolled_on      DATE NOT NULL,
  status           education.isu_student_status NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_isu_student_track ON education.isu_student(current_track_id);
CREATE INDEX idx_isu_student_status ON education.isu_student(status);

CREATE TRIGGER trg_isu_student_updated_at
  BEFORE UPDATE ON education.isu_student
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE education.isu_student IS 'ISU student. Continuous enrollment, no cohorts/semesters. person_id UNIQUE.';
