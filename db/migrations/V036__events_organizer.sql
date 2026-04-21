CREATE TABLE events.event_organizer (
  event_id   BIGINT NOT NULL REFERENCES events.event(event_id) ON DELETE CASCADE,
  member_id  BIGINT NOT NULL REFERENCES membership.member(member_id),
  role       TEXT NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);

CREATE INDEX idx_organizer_member ON events.event_organizer(member_id);

COMMENT ON TABLE events.event_organizer IS 'Event organizer assignment. Composite PK (event_id, member_id).';
