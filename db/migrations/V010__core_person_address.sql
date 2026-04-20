CREATE TYPE core.address_type AS ENUM ('HOME', 'WORK', 'MAILING');

CREATE TABLE core.person_address (
  person_id   BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  address_id  BIGINT NOT NULL REFERENCES core.address(address_id),
  type        core.address_type NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, address_id, valid_from)
);

CREATE INDEX idx_person_address_person ON core.person_address(person_id);
CREATE INDEX idx_person_address_address ON core.person_address(address_id);
CREATE INDEX idx_person_address_current
  ON core.person_address(person_id) WHERE valid_to IS NULL;

COMMENT ON TABLE core.person_address IS 'PII: person ↔ address with type and validity range. Address history retained.';
