-- Promote stg_person rows for a given batch into operational tables.
-- Usage: psql -v batch_id="'<uuid>'" -f promote_person.sql
-- Runs in a single transaction (caller wraps in BEGIN/COMMIT or relies on psql autocommit per file).

-- Expose psql variable as a session GUC so PL/pgSQL can read it via current_setting().
SELECT set_config('app.batch_id', :'batch_id', true);

DO $$
DECLARE
  r RECORD;
  v_address_id  BIGINT;
  v_person_id   BIGINT;
  v_member_id   BIGINT;
  v_branch_id   BIGINT;
  v_batch_id    UUID;
BEGIN
  v_batch_id := current_setting('app.batch_id')::uuid;

  FOR r IN
    SELECT * FROM staging.stg_person
    WHERE batch_id = v_batch_id
      AND row_status = 'VALID'
    ORDER BY staging_id
  LOOP
    v_address_id := NULL;
    v_person_id  := NULL;
    v_member_id  := NULL;

    -- 1. Address (if line1 present)
    IF r.raw_address_line1 IS NOT NULL THEN
      INSERT INTO core.address (line1, line2, city, province, postal_code, country_code)
      VALUES (
        r.raw_address_line1,
        r.raw_address_line2,
        r.raw_city,
        r.raw_province,
        r.raw_postal_code,
        COALESCE(r.raw_country, 'PH')
      )
      RETURNING address_id INTO v_address_id;
    END IF;

    -- 2. Person
    INSERT INTO core.person (first_name, last_name, middle_name, suffix, gender, date_of_birth)
    VALUES (
      r.raw_first_name,
      r.raw_last_name,
      r.raw_middle_name,
      r.raw_suffix,
      CASE WHEN r.raw_gender IS NOT NULL THEN r.raw_gender::core.gender ELSE NULL END,
      CASE WHEN r.raw_birth_date IS NOT NULL THEN r.raw_birth_date::date ELSE NULL END
    )
    RETURNING person_id INTO v_person_id;

    -- 3. Contact info: email
    IF r.raw_email IS NOT NULL THEN
      INSERT INTO core.contact_info (person_id, type, value, is_primary)
      VALUES (v_person_id, 'EMAIL', r.raw_email, true);
    END IF;

    -- 4. Contact info: phone
    IF r.raw_phone IS NOT NULL THEN
      INSERT INTO core.contact_info (person_id, type, value, is_primary)
      VALUES (v_person_id, 'MOBILE', r.raw_phone, true);
    END IF;

    -- 5. Member (if member_code present)
    IF r.raw_member_code IS NOT NULL THEN
      SELECT branch_id INTO v_branch_id
      FROM core.branch WHERE code = r.raw_branch_code;

      INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
      VALUES (
        v_person_id,
        v_branch_id,
        r.raw_member_code,
        COALESCE(r.raw_member_stage, 'FTV'),
        CASE WHEN r.raw_joined_date IS NOT NULL THEN r.raw_joined_date::timestamptz
             ELSE now() END
      )
      RETURNING member_id INTO v_member_id;
    END IF;

    -- 6. Update staging row
    UPDATE staging.stg_person
    SET promoted_to_person_id = v_person_id,
        promoted_to_member_id = v_member_id,
        promoted_at = now(),
        row_status = 'PROMOTED'
    WHERE staging_id = r.staging_id;
  END LOOP;

  UPDATE staging.import_batch
  SET status = 'PROMOTED', completed_at = now()
  WHERE batch_id = v_batch_id;
END $$;
