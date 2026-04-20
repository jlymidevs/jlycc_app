CREATE TYPE membership.application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE membership.regular_member_application (
  application_id          BIGSERIAL PRIMARY KEY,
  member_id               BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  reviewed_by_person_id   BIGINT REFERENCES core.person(person_id),
  status                  membership.application_status NOT NULL DEFAULT 'PENDING',
  criteria_checklist      JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_notes          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_member ON membership.regular_member_application(member_id);
CREATE INDEX idx_application_status ON membership.regular_member_application(status);
CREATE UNIQUE INDEX idx_application_one_pending
  ON membership.regular_member_application(member_id)
  WHERE status = 'PENDING';

CREATE TRIGGER trg_application_updated_at
  BEFORE UPDATE ON membership.regular_member_application
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE membership.regular_member_application IS 'Application to advance to Regular Member. criteria_checklist JSONB is intentionally schema-less so criteria can evolve without migrations.';
