CREATE TYPE core.branch_type AS ENUM ('LOCAL', 'INTERNATIONAL');
CREATE TYPE core.branch_status AS ENUM ('ACTIVE', 'PLANTING', 'CLOSED');

CREATE TABLE core.branch (
  branch_id          BIGSERIAL PRIMARY KEY,
  code               TEXT NOT NULL,
  name               TEXT NOT NULL,
  region_id          BIGINT NOT NULL REFERENCES core.region(region_id),
  type               core.branch_type NOT NULL,
  country_code       CHAR(2) NOT NULL,
  timezone           TEXT NOT NULL,
  primary_address_id BIGINT,  -- FK added once core.address exists (Task 4)
  launched_on        DATE,
  status             core.branch_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branch_code_unique UNIQUE (code)
);

CREATE INDEX idx_branch_region ON core.branch(region_id);
CREATE INDEX idx_branch_status ON core.branch(status);

CREATE TRIGGER trg_branch_updated_at
  BEFORE UPDATE ON core.branch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.branch IS 'Every JLY church location. The universal tenant key.';
COMMENT ON COLUMN core.branch.primary_address_id IS 'FK to core.address; constraint added by V007.';
