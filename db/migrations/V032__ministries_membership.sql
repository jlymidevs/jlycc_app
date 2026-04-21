CREATE TYPE ministries.leader_role AS ENUM ('HEAD', 'ASSISTANT_HEAD', 'COORDINATOR');

CREATE TABLE ministries.ministry_membership (
  membership_id     BIGSERIAL PRIMARY KEY,
  chapter_id        BIGINT NOT NULL REFERENCES ministries.ministry_chapter(chapter_id) ON DELETE CASCADE,
  member_id         BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  ended_reason      TEXT,
  is_leader         BOOLEAN NOT NULL DEFAULT false,
  leader_role       ministries.leader_role,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_membership_leader_check
    CHECK ((is_leader = false AND leader_role IS NULL) OR (is_leader = true AND leader_role IS NOT NULL))
);

CREATE INDEX idx_ministry_membership_chapter ON ministries.ministry_membership(chapter_id);
CREATE INDEX idx_ministry_membership_member ON ministries.ministry_membership(member_id);
CREATE INDEX idx_ministry_membership_active
  ON ministries.ministry_membership(chapter_id) WHERE ended_at IS NULL;

COMMENT ON TABLE ministries.ministry_membership IS 'Member ↔ chapter with optional leadership role. Append-only; close by setting ended_at.';
