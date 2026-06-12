-- One ACTIVE chapter per ministry at the MAIN branch so every ministry is joinable.
-- Idempotent: existing (ministry, branch) chapters are left untouched.
INSERT INTO ministries.ministry_chapter (ministry_id, branch_id, status)
SELECT m.ministry_id, b.branch_id, 'ACTIVE'
FROM ministries.ministry m
CROSS JOIN core.branch b
WHERE b.code = 'MAIN'
ON CONFLICT ON CONSTRAINT chapter_ministry_branch_unique DO NOTHING;
