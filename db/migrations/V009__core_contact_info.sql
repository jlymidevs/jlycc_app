CREATE TYPE core.contact_type AS ENUM ('MOBILE', 'EMAIL', 'LANDLINE', 'MESSENGER', 'OTHER');

CREATE TABLE core.contact_info (
  contact_id    BIGSERIAL PRIMARY KEY,
  person_id     BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  type          core.contact_type NOT NULL,
  value         TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  consented_at  TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_info_person ON core.contact_info(person_id);
CREATE INDEX idx_contact_info_type ON core.contact_info(type);
CREATE UNIQUE INDEX idx_contact_info_one_primary
  ON core.contact_info(person_id, type)
  WHERE is_primary = true;

COMMENT ON TABLE core.contact_info IS 'PII: phone, email, etc. Multiple per person; at most one primary per type.';
