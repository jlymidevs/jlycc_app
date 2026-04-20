CREATE TABLE membership.branch_membership_history (
  history_id           BIGSERIAL PRIMARY KEY,
  member_id            BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  from_branch_id       BIGINT REFERENCES core.branch(branch_id),
  to_branch_id         BIGINT NOT NULL REFERENCES core.branch(branch_id),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from       DATE,
  changed_by_person_id BIGINT REFERENCES core.person(person_id),
  reason               TEXT
);

CREATE INDEX idx_branch_history_member ON membership.branch_membership_history(member_id, changed_at DESC);

CREATE TRIGGER trg_member_branch_history
  AFTER UPDATE OF branch_id ON membership.member
  FOR EACH ROW
  EXECUTE FUNCTION public.record_history(
    'membership.branch_membership_history',
    'member_id',
    'branch_id:from_branch_id:to_branch_id'
  );

COMMENT ON TABLE membership.branch_membership_history IS 'Every change to member.branch_id (branch transfer). Auto-populated by trigger.';
