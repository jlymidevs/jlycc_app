-- V073: Network head appointments (one active head per network, append-only history)
-- NOTE: Table was initially created in V071 without ON DELETE CASCADE.
-- This migration drops and recreates the FK constraints with ON DELETE CASCADE.
-- If run on a clean DB (no V071), the table creation path handles it end-to-end.

-- Add ON DELETE CASCADE to network_id FK (drop old, re-add with cascade)
ALTER TABLE ministries.network_leader
  DROP CONSTRAINT IF EXISTS network_leader_network_id_fkey;

ALTER TABLE ministries.network_leader
  ADD CONSTRAINT network_leader_network_id_fkey
    FOREIGN KEY (network_id) REFERENCES ministries.network(network_id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to member_id FK
ALTER TABLE ministries.network_leader
  DROP CONSTRAINT IF EXISTS network_leader_member_id_fkey;

ALTER TABLE ministries.network_leader
  ADD CONSTRAINT network_leader_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES membership.member(member_id) ON DELETE CASCADE;

COMMENT ON TABLE ministries.network_leader IS
  'Network head appointments. One active head per network (partial unique on ended_at IS NULL).';
