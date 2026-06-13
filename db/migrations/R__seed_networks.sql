-- DISABLED: networks are entered manually via the admin UI.
-- Previously seeded Wind / Wave / Eagles. Left as an intentional no-op so
-- `flyway migrate` does not repopulate ministries after manual setup.
-- To restore auto-seeding, re-add the INSERT ... ON CONFLICT block.
SELECT 1 WHERE false;
