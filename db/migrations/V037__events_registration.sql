CREATE TYPE events.registration_status AS ENUM (
  'REGISTERED', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW'
);

CREATE TABLE events.event_registration (
  registration_id        BIGSERIAL PRIMARY KEY,
  event_id               BIGINT NOT NULL REFERENCES events.event(event_id),
  person_id              BIGINT NOT NULL REFERENCES core.person(person_id),
  registered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_by_member_id BIGINT REFERENCES membership.member(member_id),
  status                 events.registration_status NOT NULL DEFAULT 'REGISTERED',
  accommodation_required BOOLEAN NOT NULL DEFAULT false,
  dietary_requirements   TEXT,
  group_size             INT NOT NULL DEFAULT 1,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  payment_reference      TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_registration_event ON events.event_registration(event_id);
CREATE INDEX idx_registration_person ON events.event_registration(person_id);
CREATE INDEX idx_registration_status ON events.event_registration(event_id, status);

CREATE TRIGGER trg_registration_updated_at
  BEFORE UPDATE ON events.event_registration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN events.event_registration.emergency_contact_name IS 'PII';
COMMENT ON COLUMN events.event_registration.emergency_contact_phone IS 'PII';
COMMENT ON COLUMN events.event_registration.dietary_requirements IS 'PII';
COMMENT ON TABLE events.event_registration IS 'Event registration/RSVP. Uses person_id so non-members can register. PII: emergency contact, dietary info.';
