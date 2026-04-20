CREATE TYPE core.gender AS ENUM ('MALE', 'FEMALE', 'UNDISCLOSED');
CREATE TYPE core.marital_status AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'DIVORCED');

CREATE TABLE core.person (
  person_id         BIGSERIAL PRIMARY KEY,
  first_name        TEXT NOT NULL,
  middle_name       TEXT,
  last_name         TEXT NOT NULL,
  suffix            TEXT,
  preferred_name    TEXT,
  date_of_birth     DATE,
  gender            core.gender,
  marital_status    core.marital_status,
  nationality       TEXT,
  profile_photo_url TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_person_last_first ON core.person (last_name, first_name);
CREATE INDEX idx_person_dob ON core.person (date_of_birth);
CREATE INDEX idx_person_active ON core.person (person_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_person_name_trgm ON core.person USING GIN (
  (lower(first_name || ' ' || last_name)) gin_trgm_ops
);

CREATE TRIGGER trg_person_updated_at
  BEFORE UPDATE ON core.person
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE core.person IS 'Every individual: members, FTVs, students, BAC participants. Person can exist without a member record.';
COMMENT ON COLUMN core.person.deleted_at IS 'Soft delete timestamp; NULL = active.';
