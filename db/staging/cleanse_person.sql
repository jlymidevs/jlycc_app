-- Cleanse stg_person rows for a given batch.
-- Usage: psql -v batch_id="'<uuid>'" -f cleanse_person.sql
--   or within pgTAP: set batch_id via \gset, then \i /staging/cleanse_person.sql

UPDATE staging.stg_person
SET
  raw_first_name   = NULLIF(TRIM(raw_first_name), ''),
  raw_last_name    = NULLIF(TRIM(raw_last_name), ''),
  raw_middle_name  = NULLIF(TRIM(raw_middle_name), ''),
  raw_suffix       = NULLIF(TRIM(raw_suffix), ''),
  raw_gender       = CASE UPPER(TRIM(COALESCE(raw_gender, '')))
                       WHEN 'M' THEN 'MALE'
                       WHEN 'F' THEN 'FEMALE'
                       WHEN 'MALE' THEN 'MALE'
                       WHEN 'FEMALE' THEN 'FEMALE'
                       WHEN 'UNDISCLOSED' THEN 'UNDISCLOSED'
                       WHEN '' THEN NULL
                       ELSE UPPER(TRIM(raw_gender))
                     END,
  raw_birth_date   = NULLIF(TRIM(raw_birth_date), ''),
  raw_email        = NULLIF(LOWER(TRIM(raw_email)), ''),
  raw_phone        = NULLIF(REGEXP_REPLACE(TRIM(COALESCE(raw_phone, '')), '[^0-9+]', '', 'g'), ''),
  raw_address_line1 = NULLIF(TRIM(raw_address_line1), ''),
  raw_address_line2 = NULLIF(TRIM(raw_address_line2), ''),
  raw_city         = NULLIF(TRIM(raw_city), ''),
  raw_province     = NULLIF(TRIM(raw_province), ''),
  raw_country      = NULLIF(UPPER(TRIM(raw_country)), ''),
  raw_postal_code  = NULLIF(TRIM(raw_postal_code), ''),
  raw_branch_code  = NULLIF(UPPER(TRIM(raw_branch_code)), ''),
  raw_member_code  = NULLIF(TRIM(raw_member_code), ''),
  raw_member_stage = NULLIF(UPPER(TRIM(raw_member_stage)), ''),
  raw_joined_date  = NULLIF(TRIM(raw_joined_date), ''),
  raw_roles        = NULLIF(TRIM(raw_roles), ''),
  row_status       = 'CLEANSED'
WHERE batch_id = :'batch_id'
  AND row_status = 'RAW';

UPDATE staging.import_batch
SET status = 'CLEANSED'
WHERE batch_id = :'batch_id';
