CREATE TYPE membership.pcm_status AS ENUM ('ACTIVE', 'ENDED', 'REASSIGNED');

CREATE TABLE membership.pastoral_care_assignment (
  assignment_id      BIGSERIAL PRIMARY KEY,
  carer_member_id    BIGINT NOT NULL REFERENCES membership.member(member_id),
  assigned_member_id BIGINT NOT NULL REFERENCES membership.member(member_id),
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  status             membership.pcm_status NOT NULL DEFAULT 'ACTIVE',
  notes              TEXT,
  CONSTRAINT pcm_no_self CHECK (carer_member_id <> assigned_member_id)
);

CREATE INDEX idx_pcm_carer ON membership.pastoral_care_assignment(carer_member_id);
CREATE INDEX idx_pcm_assigned ON membership.pastoral_care_assignment(assigned_member_id);
CREATE UNIQUE INDEX idx_pcm_one_active_per_assigned
  ON membership.pastoral_care_assignment(assigned_member_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE membership.pastoral_care_assignment IS 'PCM ↔ cared-for member. Partial unique index enforces at most one active PCM per member.';
