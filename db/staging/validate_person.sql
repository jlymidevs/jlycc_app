-- Validate stg_person rows for a given batch.
-- Usage: psql -v batch_id="'<uuid>'" -f validate_person.sql

UPDATE staging.stg_person
SET validation_errors = '[]'::jsonb
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED';

-- Required: raw_first_name
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_first_name', 'error', 'required'))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND (raw_first_name IS NULL OR raw_first_name = '');

-- Required: raw_last_name
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_last_name', 'error', 'required'))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND (raw_last_name IS NULL OR raw_last_name = '');

-- Gender must be valid enum value if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_gender', 'error', 'invalid value: ' || raw_gender))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_gender IS NOT NULL
  AND raw_gender NOT IN ('MALE', 'FEMALE', 'UNDISCLOSED');

-- Branch code must exist in core.branch if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_branch_code', 'error', 'unknown branch: ' || raw_branch_code))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_branch_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM core.branch WHERE code = stg_person.raw_branch_code);

-- Member stage must be valid lifecycle_stage if present
UPDATE staging.stg_person
SET validation_errors = validation_errors || jsonb_build_array(
  jsonb_build_object('field', 'raw_member_stage', 'error', 'unknown stage: ' || raw_member_stage))
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED'
  AND raw_member_stage IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM membership.lifecycle_stage WHERE stage_code = stg_person.raw_member_stage);

-- Set final status: VALID if no errors, INVALID if errors present
UPDATE staging.stg_person
SET row_status = CASE
  WHEN jsonb_array_length(validation_errors) = 0 THEN 'VALID'
  ELSE 'INVALID'
END::staging.row_status
WHERE batch_id = :'batch_id'
  AND row_status = 'CLEANSED';

UPDATE staging.import_batch
SET status = 'VALIDATED'
WHERE batch_id = :'batch_id';
