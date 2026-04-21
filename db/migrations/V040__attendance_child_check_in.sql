CREATE TABLE attendance.child_check_in (
  check_in_id                BIGINT NOT NULL,
  checked_in_at              TIMESTAMPTZ NOT NULL,
  event_id                   BIGINT NOT NULL,
  parent_check_in_id         BIGINT,
  parent_checked_in_at       TIMESTAMPTZ,
  pickup_code                TEXT NOT NULL,
  allergies                  TEXT,
  picked_up_at               TIMESTAMPTZ,
  picked_up_by_person_id     BIGINT REFERENCES core.person(person_id),
  pickup_verified_by_member_id BIGINT REFERENCES membership.member(member_id),
  PRIMARY KEY (check_in_id, checked_in_at),
  CONSTRAINT child_check_in_fk
    FOREIGN KEY (check_in_id, checked_in_at)
    REFERENCES attendance.check_in(check_in_id, checked_in_at),
  CONSTRAINT child_check_in_parent_fk
    FOREIGN KEY (parent_check_in_id, parent_checked_in_at)
    REFERENCES attendance.check_in(check_in_id, checked_in_at),
  CONSTRAINT child_check_in_pickup_unique UNIQUE (event_id, pickup_code)
);

CREATE INDEX idx_child_check_in_parent ON attendance.child_check_in(parent_check_in_id);

COMMENT ON COLUMN attendance.child_check_in.allergies IS 'PII';
COMMENT ON TABLE attendance.child_check_in IS 'Child check-in extension. 1:1 with check_in. Pickup code unique per event for child safety.';
