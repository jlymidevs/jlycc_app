UPDATE events.event_type
SET ministry_id = NULL,
    network_id = NULL
WHERE ministry_id IS NOT NULL
   OR network_id IS NOT NULL;

DELETE FROM ministries.ministry_chapter;
DELETE FROM ministries.ministry;
DELETE FROM ministries.network;
