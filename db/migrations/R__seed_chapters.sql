-- DISABLED: chapters are created manually via the admin UI.
-- Previously created one ACTIVE MAIN-branch chapter per ministry. Left as an
-- intentional no-op so `flyway migrate` does not repopulate chapters after
-- manual setup. To restore, re-add the INSERT ... SELECT block.
SELECT 1 WHERE false;
