CREATE TYPE missions.bac_role AS ENUM ('LEADER', 'FACILITATOR', 'PARTICIPANT', 'VOLUNTEER');
CREATE TYPE missions.attendance_role AS ENUM ('ENROLLED', 'WALK_IN', 'FACILITATOR');

CREATE TABLE missions.bac_participant (
  participant_id   BIGSERIAL PRIMARY KEY,
  initiative_id    BIGINT NOT NULL REFERENCES missions.bac_initiative(initiative_id) ON DELETE CASCADE,
  person_id        BIGINT NOT NULL REFERENCES core.person(person_id),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at          TIMESTAMPTZ,
  role             missions.bac_role NOT NULL DEFAULT 'PARTICIPANT',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bac_participant_initiative ON missions.bac_participant(initiative_id);
CREATE INDEX idx_bac_participant_person ON missions.bac_participant(person_id);

COMMENT ON TABLE missions.bac_participant IS 'BAC participant. Uses person_id — open to non-members. Append-only; close by setting left_at.';

CREATE TABLE missions.bac_session_attendance (
  attendance_id  BIGSERIAL PRIMARY KEY,
  session_id     BIGINT NOT NULL REFERENCES missions.bac_session(session_id) ON DELETE CASCADE,
  person_id      BIGINT NOT NULL REFERENCES core.person(person_id),
  attended       BOOLEAN NOT NULL,
  attended_as    missions.attendance_role NOT NULL DEFAULT 'ENROLLED',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bac_attendance_unique UNIQUE (session_id, person_id)
);

CREATE INDEX idx_bac_attendance_person ON missions.bac_session_attendance(person_id);

COMMENT ON TABLE missions.bac_session_attendance IS 'BAC per-session attendance. Links to person_id directly so walk-ins are trackable without prior enrollment.';
