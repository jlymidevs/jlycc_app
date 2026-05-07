CREATE TABLE staging.stg_person (
  staging_id             BIGSERIAL PRIMARY KEY,
  batch_id               UUID NOT NULL REFERENCES staging.import_batch(batch_id),
  source_row_number      INT,
  row_status             staging.row_status NOT NULL DEFAULT 'RAW',
  raw_first_name         TEXT,
  raw_last_name          TEXT,
  raw_middle_name        TEXT,
  raw_suffix             TEXT,
  raw_gender             TEXT,
  raw_birth_date         TEXT,
  raw_email              TEXT,
  raw_phone              TEXT,
  raw_address_line1      TEXT,
  raw_address_line2      TEXT,
  raw_city               TEXT,
  raw_province           TEXT,
  raw_country            TEXT,
  raw_postal_code        TEXT,
  raw_branch_code        TEXT,
  raw_member_code        TEXT,
  raw_member_stage       TEXT,
  raw_joined_date        TEXT,
  raw_roles              TEXT,
  validation_errors      JSONB,
  promoted_to_person_id  BIGINT,
  promoted_to_member_id  BIGINT,
  promoted_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stg_person_batch ON staging.stg_person(batch_id);
CREATE INDEX idx_stg_person_status ON staging.stg_person(row_status);

COMMENT ON TABLE staging.stg_person IS 'Raw person/member import. All raw_ columns are TEXT. Pattern table for future stg_* tables.';
