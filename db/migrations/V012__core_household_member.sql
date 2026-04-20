CREATE TYPE core.household_role AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'OTHER');

CREATE TABLE core.household_member (
  household_id      BIGINT NOT NULL REFERENCES core.household(household_id) ON DELETE CASCADE,
  person_id         BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  role_in_household core.household_role NOT NULL,
  joined_at         TIMESTAMPTZ NOT NULL,
  left_at           TIMESTAMPTZ,
  PRIMARY KEY (household_id, person_id, joined_at)
);

CREATE INDEX idx_household_member_person ON core.household_member(person_id);
CREATE INDEX idx_household_member_active
  ON core.household_member(household_id) WHERE left_at IS NULL;

COMMENT ON TABLE core.household_member IS 'Person ↔ household with role and history.';
