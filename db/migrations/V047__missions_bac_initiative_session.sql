CREATE TYPE missions.initiative_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE missions.bac_initiative (
  initiative_id          BIGSERIAL PRIMARY KEY,
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                   TEXT NOT NULL,
  target_community       TEXT,
  starts_on              DATE,
  ends_on                DATE,
  coordinator_member_id  BIGINT REFERENCES membership.member(member_id),
  status                 missions.initiative_status NOT NULL DEFAULT 'PLANNING',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_initiative_branch ON missions.bac_initiative(branch_id);
CREATE INDEX idx_bac_initiative_status ON missions.bac_initiative(status);

CREATE TRIGGER trg_bac_initiative_updated_at
  BEFORE UPDATE ON missions.bac_initiative
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.bac_initiative IS 'BAC (Bless A Community) outreach campaign.';

CREATE TABLE missions.bac_session (
  session_id             BIGSERIAL PRIMARY KEY,
  initiative_id          BIGINT NOT NULL REFERENCES missions.bac_initiative(initiative_id) ON DELETE CASCADE,
  session_number         INT NOT NULL,
  topic                  TEXT,
  scheduled_at           TIMESTAMPTZ,
  duration_minutes       INT,
  venue                  TEXT,
  facilitator_member_id  BIGINT REFERENCES membership.member(member_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_session_initiative ON missions.bac_session(initiative_id);

CREATE TRIGGER trg_bac_session_updated_at
  BEFORE UPDATE ON missions.bac_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE missions.bac_session IS 'Session within a BAC initiative.';
