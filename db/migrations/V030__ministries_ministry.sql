CREATE TABLE ministries.ministry (
  ministry_id        BIGSERIAL PRIMARY KEY,
  network_id         BIGINT NOT NULL REFERENCES ministries.network(network_id),
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  target_demographic TEXT,
  founded_on         DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ministry_network ON ministries.ministry(network_id);

CREATE TRIGGER trg_ministry_updated_at
  BEFORE UPDATE ON ministries.ministry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.ministry IS 'A ministry (Move, CCEM, LT Pro, etc.) under a network.';
