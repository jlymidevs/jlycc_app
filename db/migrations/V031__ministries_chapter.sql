CREATE TYPE ministries.chapter_status AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

CREATE TABLE ministries.ministry_chapter (
  chapter_id   BIGSERIAL PRIMARY KEY,
  ministry_id  BIGINT NOT NULL REFERENCES ministries.ministry(ministry_id),
  branch_id    BIGINT NOT NULL REFERENCES core.branch(branch_id),
  launched_on  DATE,
  status       ministries.chapter_status NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapter_ministry_branch_unique UNIQUE (ministry_id, branch_id)
);

CREATE INDEX idx_chapter_branch ON ministries.ministry_chapter(branch_id);
CREATE INDEX idx_chapter_status ON ministries.ministry_chapter(status);

CREATE TRIGGER trg_chapter_updated_at
  BEFORE UPDATE ON ministries.ministry_chapter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.ministry_chapter IS 'Per-branch instance of a ministry. UNIQUE(ministry_id, branch_id).';
