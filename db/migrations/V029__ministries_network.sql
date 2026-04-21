CREATE TABLE ministries.network (
  network_id   BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  founded_on   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_network_updated_at
  BEFORE UPDATE ON ministries.network
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.network IS 'Top-level ministry grouping (Eagles, Wind, Lead Takers).';
