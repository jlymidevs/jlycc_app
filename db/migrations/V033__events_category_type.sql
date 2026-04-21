CREATE TABLE events.event_category (
  category_code TEXT PRIMARY KEY,
  name          TEXT NOT NULL
);

COMMENT ON TABLE events.event_category IS 'Event categories: SEASONAL (one-off) or REGULAR (recurring).';

CREATE TABLE events.event_type (
  event_type_id          BIGSERIAL PRIMARY KEY,
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  category_code          TEXT NOT NULL REFERENCES events.event_category(category_code),
  network_id             BIGINT REFERENCES ministries.network(network_id),
  ministry_id            BIGINT REFERENCES ministries.ministry(ministry_id),
  typical_duration_minutes INT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_type_category ON events.event_type(category_code);

CREATE TRIGGER trg_event_type_updated_at
  BEFORE UPDATE ON events.event_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event_type IS 'Lookup of event types. network_id/ministry_id link to owning ministry when applicable.';
