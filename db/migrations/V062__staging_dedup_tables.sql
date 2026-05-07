CREATE TYPE staging.merge_review_status AS ENUM ('PENDING', 'MERGED', 'DISTINCT', 'SKIPPED');

CREATE TABLE staging.dedup_run (
  run_id             BIGSERIAL PRIMARY KEY,
  batch_id           UUID REFERENCES staging.import_batch(batch_id),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  candidates_found   INT,
  auto_merged        INT,
  queued_for_review  INT,
  distinct_persons   INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dedup_run_batch ON staging.dedup_run(batch_id);

COMMENT ON TABLE staging.dedup_run IS 'Dedup run tracker. Stats on each deduplication pass.';

CREATE TABLE staging.person_candidate (
  candidate_id       BIGSERIAL PRIMARY KEY,
  run_id             BIGINT NOT NULL REFERENCES staging.dedup_run(run_id),
  staging_id         BIGINT NOT NULL REFERENCES staging.stg_person(staging_id),
  first_name         TEXT,
  last_name          TEXT,
  phone              TEXT,
  email              TEXT,
  birth_date         DATE,
  blocking_key       TEXT,
  resolved_person_id BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_person_candidate_run ON staging.person_candidate(run_id);
CREATE INDEX idx_person_candidate_blocking ON staging.person_candidate(blocking_key);

COMMENT ON TABLE staging.person_candidate IS 'Normalized person candidates for dedup. blocking_key = last_name + first_initial + phone-last-4.';

CREATE TABLE staging.person_merge_review (
  review_id        BIGSERIAL PRIMARY KEY,
  run_id           BIGINT NOT NULL REFERENCES staging.dedup_run(run_id),
  candidate_a_id   BIGINT NOT NULL REFERENCES staging.person_candidate(candidate_id),
  candidate_b_id   BIGINT NOT NULL REFERENCES staging.person_candidate(candidate_id),
  confidence_score NUMERIC NOT NULL,
  status           staging.merge_review_status NOT NULL DEFAULT 'PENDING',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT person_merge_review_pair_unique UNIQUE (candidate_a_id, candidate_b_id)
);

CREATE INDEX idx_merge_review_status ON staging.person_merge_review(status);

COMMENT ON TABLE staging.person_merge_review IS 'Person merge review queue. Pairs at 70-95% confidence for manual resolution.';
