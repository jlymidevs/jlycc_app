# Codex Prompt — Neon → Supabase Migration

Copy-paste the block below to Codex. Fill in the `<...>` placeholders first.

```
You are working in the JLYCC App repo (Next.js on Vercel, Postgres DB).

TASK: Migrate the production database from Neon (PostgreSQL 18.4) to a managed
Supabase Postgres project. This is DATABASE-ONLY. The app stays on Vercel —
do NOT touch Vercel hosting or CI/CD. NO app-code change is needed: the app
reads process.env.DATABASE_URL, so this is dump → restore → env swap.

SOURCE OF TRUTH: Follow docs/MIGRATE_NEON_TO_SUPABASE.md exactly, step by step
(Steps 1–6). Do not skip or reorder steps. If that file is not present, check
out branch `docs/cloudsql-migration-runbook` first.

CONTEXT YOU NEED FROM ME:
- Supabase project created in region Southeast Asia (Singapore): <yes/no>
- Supabase Postgres version chosen (pick newest, ideally 17): <fill in>
- Supabase DIRECT connection string (port 5432): <fill in>
- Supabase TRANSACTION POOLER string (port 6543): <fill in>
- Neon connection string is in app/.env as DATABASE_URL (do not print it).

KEY FACTS:
- app/src/lib/db.ts already uses postgres-js with prepare:false, which is what
  the Supabase transaction pooler needs → no code change.
- The dump carries the full schema + flyway_schema_history, so Supabase lands
  at V075 immediately. Flyway is only for FUTURE migrations.
- App connection = pooler (6543). Restore + Flyway = direct (5432).

HARD RULES:
1. DB only. No Vercel/CI changes. No db.ts change.
2. Never commit secrets: app/.env, any password, or DB dumps in backups/.
   Confirm they stay gitignored.
3. Do not delete or edit any V0xx Flyway migration file.
4. Do NOT drop or disable Neon. Keep it intact as the rollback until Supabase
   is verified stable.
5. Use postgres:18 Docker image for pg_dump/psql (Neon is PG18).
6. Restore via the DIRECT (5432) string, not the pooler.
7. After restore, verify (runbook Step 4): network_leader table exists,
   is_inner_core column exists, networks = Eagles/Wave/Wind, 17 ministries,
   17 active chapters, flyway version = 075. Cross-check row counts vs Neon.
8. If the restore reports real errors (not just "already exists"), or if
   verification is unexpected, STOP and report — do not force the cutover.

DELIVERABLES:
- Supabase project restored + verified.
- The exact DATABASE_URL value (pooler 6543) for me to set in Vercel.
- A short report: what you ran, verification output, and rollback steps.

Work in small steps. Show me the verification output before recommending the
Vercel DATABASE_URL swap.
```
