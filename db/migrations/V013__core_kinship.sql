CREATE TYPE core.kinship_type AS ENUM ('SPOUSE', 'PARENT_OF', 'CHILD_OF', 'SIBLING', 'OTHER');

CREATE TABLE core.kinship (
  kinship_id        BIGSERIAL PRIMARY KEY,
  person_id         BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  related_person_id BIGINT NOT NULL REFERENCES core.person(person_id) ON DELETE CASCADE,
  relationship      core.kinship_type NOT NULL,
  valid_from        DATE NOT NULL,
  valid_to          DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kinship_no_self CHECK (person_id <> related_person_id)
);

CREATE INDEX idx_kinship_person ON core.kinship(person_id);
CREATE INDEX idx_kinship_related ON core.kinship(related_person_id);
CREATE INDEX idx_kinship_active ON core.kinship(person_id) WHERE valid_to IS NULL;

COMMENT ON TABLE core.kinship IS 'Spouse / parent / sibling graph. Stored one direction per relationship; query via core.kinship_bidirectional.';
