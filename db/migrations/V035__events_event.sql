CREATE TYPE events.event_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE events.event (
  event_id        BIGSERIAL PRIMARY KEY,
  event_type_id   BIGINT NOT NULL REFERENCES events.event_type(event_type_id),
  series_id       BIGINT REFERENCES events.event_series(series_id),
  branch_id       BIGINT REFERENCES core.branch(branch_id),
  host_branch_id  BIGINT REFERENCES core.branch(branch_id),
  name            TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  venue           TEXT,
  expected_attendance INT,
  status          events.event_status NOT NULL DEFAULT 'SCHEDULED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_type ON events.event(event_type_id);
CREATE INDEX idx_event_series ON events.event(series_id);
CREATE INDEX idx_event_branch ON events.event(branch_id);
CREATE INDEX idx_event_starts_at ON events.event(starts_at DESC);
CREATE INDEX idx_event_status ON events.event(status);

CREATE TRIGGER trg_event_updated_at
  BEFORE UPDATE ON events.event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event IS 'Concrete event instance. branch_id = owning branch; host_branch_id = physical venue branch.';
