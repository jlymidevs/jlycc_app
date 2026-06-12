-- V071: Network head appointments (one active head per network)
CREATE TABLE ministries.network_leader (
  leader_id    BIGSERIAL PRIMARY KEY,
  network_id   BIGINT NOT NULL REFERENCES ministries.network(network_id),
  member_id    BIGINT NOT NULL REFERENCES membership.member(member_id),
  appointed_by BIGINT REFERENCES membership.member(member_id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_head_per_network
  ON ministries.network_leader(network_id) WHERE ended_at IS NULL;

CREATE INDEX idx_network_leader_member ON ministries.network_leader(member_id);

COMMENT ON TABLE ministries.network_leader IS
  'Network head appointments. One active head per network (partial unique).';
