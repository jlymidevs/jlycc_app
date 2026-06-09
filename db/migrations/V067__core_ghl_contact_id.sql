-- Add GHL contact ID to person for bidirectional sync
ALTER TABLE core.person
  ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS person_ghl_contact_id_uq
  ON core.person (ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;
