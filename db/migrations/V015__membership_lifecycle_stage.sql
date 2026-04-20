CREATE TABLE membership.lifecycle_stage (
  stage_code  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership.lifecycle_stage IS 'Lookup of member lifecycle stages. FTV→DFL/OGV/RA→REGULAR_MEMBER journey.';
