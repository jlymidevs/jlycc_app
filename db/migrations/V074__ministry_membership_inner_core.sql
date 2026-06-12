-- V074: Inner Core designation per chapter membership
ALTER TABLE ministries.ministry_membership
  ADD COLUMN is_inner_core BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_ministry_membership_inner_core
  ON ministries.ministry_membership(chapter_id) WHERE is_inner_core = true AND ended_at IS NULL;
