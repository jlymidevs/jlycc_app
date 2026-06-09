CREATE SCHEMA IF NOT EXISTS communications;

CREATE TYPE communications.announcement_target_type AS ENUM (
  'ALL_MEMBERS', 'BRANCH', 'LIFECYCLE_STAGE', 'MANUAL'
);

CREATE TYPE communications.announcement_status AS ENUM (
  'DRAFT', 'PUBLISHED', 'ARCHIVED'
);

CREATE TABLE communications.announcement (
  announcement_id      BIGSERIAL PRIMARY KEY,
  title                TEXT NOT NULL,
  body                 TEXT NOT NULL,
  target_type          communications.announcement_target_type NOT NULL,
  target_id            TEXT,
  status               communications.announcement_status NOT NULL DEFAULT 'DRAFT',
  published_at         TIMESTAMPTZ,
  created_by_person_id BIGINT REFERENCES core.person(person_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE communications.announcement_recipient (
  recipient_id     BIGSERIAL PRIMARY KEY,
  announcement_id  BIGINT NOT NULL REFERENCES communications.announcement(announcement_id) ON DELETE CASCADE,
  person_id        BIGINT NOT NULL REFERENCES core.person(person_id),
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, person_id)
);
