-- Fix: column-level REVOKE is ineffective when table-level SELECT is granted.
-- PostgreSQL table-level grants take precedence over column-level revokes.
-- Must revoke the whole table, then re-grant only non-PII columns.

REVOKE SELECT ON core.person FROM app_general;

GRANT SELECT (
  person_id, first_name, middle_name, last_name, suffix, preferred_name,
  gender, marital_status, nationality, profile_photo_url,
  created_at, updated_at, deleted_at
) ON core.person TO app_general;
