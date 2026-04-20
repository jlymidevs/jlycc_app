CREATE TABLE core.address (
  address_id   BIGSERIAL PRIMARY KEY,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT,
  province     TEXT,
  postal_code  TEXT,
  country_code CHAR(2) NOT NULL,
  geom         POINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_address_updated_at
  BEFORE UPDATE ON core.address
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Now wire core.branch.primary_address_id to core.address (forward reference from V006).
ALTER TABLE core.branch
  ADD CONSTRAINT branch_primary_address_fk
  FOREIGN KEY (primary_address_id) REFERENCES core.address(address_id);

CREATE INDEX idx_branch_primary_address ON core.branch(primary_address_id);

COMMENT ON TABLE core.address IS 'Reusable physical addresses; linked from persons, households, branches.';
