CREATE TYPE events.recurrence_pattern AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE events.series_status AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

CREATE TABLE events.event_series (
  series_id          BIGSERIAL PRIMARY KEY,
  event_type_id      BIGINT NOT NULL REFERENCES events.event_type(event_type_id),
  branch_id          BIGINT REFERENCES core.branch(branch_id),
  name               TEXT NOT NULL,
  recurrence_pattern events.recurrence_pattern NOT NULL,
  recurrence_config  JSONB NOT NULL DEFAULT '{}',
  starts_on          DATE NOT NULL,
  ends_on            DATE,
  status             events.series_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_series_event_type ON events.event_series(event_type_id);
CREATE INDEX idx_series_branch ON events.event_series(branch_id);

CREATE TRIGGER trg_series_updated_at
  BEFORE UPDATE ON events.event_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event_series IS 'Recurring event schedule. recurrence_config JSONB is app-interpreted.';
