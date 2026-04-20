CREATE TABLE membership.member_role (
  member_role_id        BIGSERIAL PRIMARY KEY,
  member_id             BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  role_id               BIGINT NOT NULL REFERENCES membership.role(role_id),
  branch_id             BIGINT REFERENCES core.branch(branch_id),
  region_id             BIGINT REFERENCES core.region(region_id),
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ,
  assigned_by_person_id BIGINT REFERENCES core.person(person_id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_role_ended_after_assigned CHECK (ended_at IS NULL OR ended_at > assigned_at)
);

CREATE INDEX idx_member_role_member ON membership.member_role(member_id);
CREATE INDEX idx_member_role_role ON membership.member_role(role_id);
CREATE INDEX idx_member_role_active
  ON membership.member_role(member_id) WHERE ended_at IS NULL;
CREATE INDEX idx_member_role_branch ON membership.member_role(branch_id);
CREATE INDEX idx_member_role_region ON membership.member_role(region_id);

COMMENT ON TABLE membership.member_role IS 'Stackable role assignments. branch_id/region_id scope where applicable (e.g., Regional Director).';
