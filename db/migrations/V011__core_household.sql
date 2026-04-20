CREATE TABLE core.household (
  household_id          BIGSERIAL PRIMARY KEY,
  branch_id             BIGINT NOT NULL REFERENCES core.branch(branch_id),
  name                  TEXT NOT NULL,
  primary_address_id    BIGINT REFERENCES core.address(address_id),
  head_of_household_id  BIGINT REFERENCES core.person(person_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_household_branch ON core.household(branch_id);
CREATE INDEX idx_household_head ON core.household(head_of_household_id);
CREATE INDEX idx_household_address ON core.household(primary_address_id);
CREATE INDEX idx_household_active ON core.household(household_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_household_updated_at
  BEFORE UPDATE ON core.household
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.household IS 'Operational family unit (e.g., "The Cruz Family").';
