-- FB-style ministry join requests with priority ranks.
-- Grants: V042 default privileges on schema ministries cover new tables/sequences.
CREATE TYPE ministries.join_request_status AS ENUM ('PENDING','APPROVED','REJECTED');

CREATE TABLE ministries.join_request (
  request_id            bigserial PRIMARY KEY,
  member_id             bigint NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  chapter_id            bigint NOT NULL REFERENCES ministries.ministry_chapter(chapter_id) ON DELETE CASCADE,
  priority              smallint NOT NULL CHECK (priority >= 1),
  status                ministries.join_request_status NOT NULL DEFAULT 'PENDING',
  requested_at          timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz,
  decided_by_member_id  bigint REFERENCES membership.member(member_id)
);

-- One pending request per member per chapter.
CREATE UNIQUE INDEX join_request_pending_unique
  ON ministries.join_request (member_id, chapter_id) WHERE status = 'PENDING';

CREATE INDEX join_request_chapter_pending_idx
  ON ministries.join_request (chapter_id) WHERE status = 'PENDING';

-- Priority rank carried onto membership when approved.
ALTER TABLE ministries.ministry_membership ADD COLUMN priority smallint;
