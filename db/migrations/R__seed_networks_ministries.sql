-- DISABLED: ministries (and their MAIN-branch chapters) are entered manually
-- via the admin UI. Previously seeded the 17 Wind/Wave/Eagles ministries plus a
-- chapter per ministry. Left as an intentional no-op so `flyway migrate` does
-- not repopulate ministries after manual setup.
-- To restore auto-seeding, re-add the INSERT blocks (depends on R__seed_networks).
SELECT 1 WHERE false;
