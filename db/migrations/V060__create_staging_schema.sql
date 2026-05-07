CREATE SCHEMA IF NOT EXISTS staging;
COMMENT ON SCHEMA staging IS 'Raw imports from Google Sheets for one-shot migration.';

CREATE TYPE staging.batch_status AS ENUM (
  'LOADING', 'LOADED', 'CLEANSING', 'CLEANSED',
  'VALIDATING', 'VALIDATED', 'PROMOTING', 'PROMOTED', 'FAILED'
);

CREATE TYPE staging.row_status AS ENUM (
  'RAW', 'CLEANSED', 'VALID', 'INVALID', 'PROMOTED', 'SKIPPED'
);

CREATE TABLE staging.import_batch (
  batch_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name   TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'GOOGLE_SHEET',
  row_count     INT,
  status        staging.batch_status NOT NULL DEFAULT 'LOADING',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batch_status ON staging.import_batch(status);

COMMENT ON TABLE staging.import_batch IS 'Import batch tracker. One row per load run.';
