CREATE VIEW core.kinship_bidirectional AS
SELECT
  kinship_id,
  person_id,
  related_person_id,
  relationship,
  valid_from,
  valid_to,
  notes,
  'FORWARD' AS direction
FROM core.kinship
UNION ALL
SELECT
  kinship_id,
  related_person_id  AS person_id,
  person_id          AS related_person_id,
  CASE relationship
    WHEN 'PARENT_OF' THEN 'CHILD_OF'::core.kinship_type
    WHEN 'CHILD_OF'  THEN 'PARENT_OF'::core.kinship_type
    ELSE relationship  -- SPOUSE, SIBLING, OTHER are symmetric
  END AS relationship,
  valid_from,
  valid_to,
  notes,
  'INVERSE' AS direction
FROM core.kinship;

COMMENT ON VIEW core.kinship_bidirectional IS 'Materializes both directions of each kinship row; PARENT_OF/CHILD_OF flipped, SPOUSE/SIBLING/OTHER symmetric.';
