CREATE TABLE membership.lifecycle_stage_history (
  history_id           BIGSERIAL PRIMARY KEY,
  member_id            BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  from_stage           TEXT REFERENCES membership.lifecycle_stage(stage_code),
  to_stage             TEXT NOT NULL REFERENCES membership.lifecycle_stage(stage_code),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from       DATE,
  changed_by_person_id BIGINT REFERENCES core.person(person_id),
  reason               TEXT
);

CREATE INDEX idx_lifecycle_history_member ON membership.lifecycle_stage_history(member_id, changed_at DESC);

-- Wire the generic record_history trigger to fire on stage changes.
CREATE TRIGGER trg_member_lifecycle_history
  AFTER UPDATE OF current_stage ON membership.member
  FOR EACH ROW
  EXECUTE FUNCTION public.record_history(
    'membership.lifecycle_stage_history',
    'member_id',
    'current_stage:from_stage:to_stage'
  );

COMMENT ON TABLE membership.lifecycle_stage_history IS 'Every change to member.current_stage. Auto-populated by trigger.';
