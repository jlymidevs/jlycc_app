CREATE TYPE membership.member_status AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DECEASED');

CREATE TABLE membership.member (
  member_id              BIGSERIAL PRIMARY KEY,
  person_id              BIGINT NOT NULL UNIQUE REFERENCES core.person(person_id),
  branch_id              BIGINT NOT NULL REFERENCES core.branch(branch_id),
  member_code            TEXT NOT NULL UNIQUE,
  current_stage          TEXT NOT NULL REFERENCES membership.lifecycle_stage(stage_code),
  joined_at              TIMESTAMPTZ NOT NULL,
  regular_member_since   TIMESTAMPTZ,
  status                 membership.member_status NOT NULL DEFAULT 'ACTIVE',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_member_branch_stage ON membership.member(branch_id, current_stage);
CREATE INDEX idx_member_status ON membership.member(status);
CREATE INDEX idx_member_active ON membership.member(member_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_member_updated_at
  BEFORE UPDATE ON membership.member
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE membership.member IS 'A person who is known to the church at any lifecycle stage. branch_id is current home branch (denormalized for query speed); transfers tracked in branch_membership_history.';
