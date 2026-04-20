-- CHECK constraints on country_code (#8, #11)
ALTER TABLE core.branch ADD CONSTRAINT branch_country_code_format
  CHECK (country_code ~ '^[A-Z]{2}$');
ALTER TABLE core.address ADD CONSTRAINT address_country_code_format
  CHECK (country_code ~ '^[A-Z]{2}$');

-- CHECK on date_of_birth (#13)
ALTER TABLE core.person ADD CONSTRAINT person_dob_not_future
  CHECK (date_of_birth <= CURRENT_DATE);

-- ON DELETE SET NULL for household.head_of_household_id (#23)
ALTER TABLE core.household DROP CONSTRAINT household_head_of_household_id_fkey;
ALTER TABLE core.household ADD CONSTRAINT household_head_of_household_id_fkey
  FOREIGN KEY (head_of_household_id) REFERENCES core.person(person_id) ON DELETE SET NULL;

-- No-op guard on history triggers (#27)
DROP TRIGGER trg_member_lifecycle_history ON membership.member;
CREATE TRIGGER trg_member_lifecycle_history
  AFTER UPDATE OF current_stage ON membership.member
  FOR EACH ROW
  WHEN (OLD.current_stage IS DISTINCT FROM NEW.current_stage)
  EXECUTE FUNCTION public.record_history(
    'membership.lifecycle_stage_history',
    'member_id',
    'current_stage:from_stage:to_stage'
  );

DROP TRIGGER trg_member_branch_history ON membership.member;
CREATE TRIGGER trg_member_branch_history
  AFTER UPDATE OF branch_id ON membership.member
  FOR EACH ROW
  WHEN (OLD.branch_id IS DISTINCT FROM NEW.branch_id)
  EXECUTE FUNCTION public.record_history(
    'membership.branch_membership_history',
    'member_id',
    'branch_id:from_branch_id:to_branch_id'
  );

-- Partial unique on active kinships (#25)
CREATE UNIQUE INDEX idx_kinship_active_pair
  ON core.kinship(person_id, related_person_id, relationship)
  WHERE valid_to IS NULL;

-- PII column markers (#17)
COMMENT ON COLUMN core.person.date_of_birth IS 'PII';
COMMENT ON COLUMN core.person.notes IS 'PII';
COMMENT ON COLUMN core.person.profile_photo_url IS 'PII';
