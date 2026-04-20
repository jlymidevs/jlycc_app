BEGIN;
SELECT plan(3);

SELECT has_view('core', 'kinship_bidirectional', 'view exists');

INSERT INTO core.person (first_name, last_name) VALUES ('Parent', 'X') RETURNING person_id AS p_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Child', 'X') RETURNING person_id AS c_id \gset

INSERT INTO core.kinship (person_id, related_person_id, relationship, valid_from)
  VALUES (:p_id, :c_id, 'PARENT_OF', CURRENT_DATE);

-- Forward direction
SELECT is(
  (SELECT relationship::text FROM core.kinship_bidirectional
    WHERE person_id = :p_id AND related_person_id = :c_id),
  'PARENT_OF',
  'forward direction visible in view'
);

-- Inverse direction (should appear as CHILD_OF for the child)
SELECT is(
  (SELECT relationship::text FROM core.kinship_bidirectional
    WHERE person_id = :c_id AND related_person_id = :p_id),
  'CHILD_OF',
  'PARENT_OF flipped to CHILD_OF in view'
);

SELECT * FROM finish();
ROLLBACK;
