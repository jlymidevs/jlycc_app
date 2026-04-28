CREATE TYPE missions.program_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE missions.award_status AS ENUM ('AWARDED', 'ACTIVE', 'COMPLETED', 'REVOKED');

CREATE TABLE missions.scholar_program (
  program_id   BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  starts_on    DATE,
  ends_on      DATE,
  description  TEXT,
  status       missions.program_status NOT NULL DEFAULT 'PLANNING',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scholar_program_status ON missions.scholar_program(status);

CREATE TRIGGER trg_scholar_program_updated_at
  BEFORE UPDATE ON missions.scholar_program
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.scholar_program IS 'Scholarship program definition.';

CREATE TABLE missions.scholarship_award (
  award_id            BIGSERIAL PRIMARY KEY,
  program_id          BIGINT NOT NULL REFERENCES missions.scholar_program(program_id),
  member_id           BIGINT NOT NULL REFERENCES membership.member(member_id),
  awarded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  term                TEXT,
  amount              NUMERIC,
  school_name         TEXT,
  sponsor_member_id   BIGINT REFERENCES membership.member(member_id),
  status              missions.award_status NOT NULL DEFAULT 'AWARDED',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_award_program ON missions.scholarship_award(program_id);
CREATE INDEX idx_award_member ON missions.scholarship_award(member_id);
CREATE INDEX idx_award_sponsor ON missions.scholarship_award(sponsor_member_id);

CREATE TRIGGER trg_scholarship_award_updated_at
  BEFORE UPDATE ON missions.scholarship_award
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.scholarship_award IS 'Scholarship award to a JLY member. school_name is free text (internal or external). Amount is informational only.';
