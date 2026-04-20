CREATE TYPE core.region_type AS ENUM ('LOCAL_CLUSTER', 'INTERNATIONAL_COUNTRY');

CREATE TABLE core.region (
  region_id        BIGSERIAL PRIMARY KEY,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             core.region_type NOT NULL,
  parent_region_id BIGINT REFERENCES core.region(region_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT region_code_unique UNIQUE (code)
);

CREATE INDEX idx_region_parent ON core.region(parent_region_id);

CREATE TRIGGER trg_region_updated_at
  BEFORE UPDATE ON core.region
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.region IS 'Local clusters (NCR, REGION-3...) and international countries.';
