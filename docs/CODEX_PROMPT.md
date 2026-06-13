# Codex Prompt — Neon → GCP Cloud SQL Migration

Copy-paste the block below to Codex. Fill in the `<...>` placeholders first.

```
You are working in the JLYCC App repo (Next.js on Vercel, Postgres DB).

TASK: Migrate the production database from Neon (PostgreSQL 18.4) to Google
Cloud SQL for PostgreSQL. This is DATABASE-ONLY. The app stays on Vercel —
do NOT touch Vercel hosting, Cloud Run, or CI/CD. The only app-code file you
may change is app/src/lib/db.ts.

SOURCE OF TRUTH: Follow docs/MIGRATE_NEON_TO_CLOUDSQL.md exactly, step by step
(Steps 1–10). Do not skip steps or reorder them. If that file is not present,
check out branch `docs/cloudsql-migration-runbook` first.

CONTEXT YOU NEED FROM ME:
- GCP project id: <FILL IN>
- Billing / Google-for-Nonprofits credits are attached to that project: <yes/no>
- gcloud is installed and `gcloud auth login` is done: <yes/no>
- App DB password to set (DB_PASS): <generate a strong one>
- Neon connection string is in app/.env as DATABASE_URL (do not print it).

CONNECTIVITY DECISION (already made): use the Cloud SQL Node Connector
(@google-cloud/cloud-sql-connector), no public IP for the app path. Service
account with roles/cloudsql.client.

HARD RULES:
1. DB only. No Vercel/hosting/CI changes.
2. Never commit secrets: app/.env, the service-account key JSON, any password,
   or DB dumps in backups/. Confirm they stay gitignored.
3. Do not delete or edit any V0xx Flyway migration file.
4. Do NOT drop or disable Neon. Keep it intact as the rollback until Cloud SQL
   is verified stable.
5. Before cutover, `cd app && npx tsc --noEmit && npm run build` MUST pass.
   Never ship a broken build. The db.ts example in the runbook uses top-level
   await — if it breaks the build, refactor to an async getDb() accessor (or
   the public-IP+SSL fallback noted in the doc) so it compiles.
6. If POSTGRES_18 is unavailable in region asia-southeast1, use POSTGRES_17 and
   confirm the logical restore succeeds.
7. After the restore, verify (runbook Step 8): network_leader table exists,
   is_inner_core column exists, networks = Eagles/Wave/Wind, 17 ministries,
   17 active chapters, flyway version = 075. Cross-check row counts vs Neon.
8. If ANYTHING in verification is unexpected, STOP and report — do not force
   the Vercel cutover.

DELIVERABLES:
- Cloud SQL instance provisioned + data restored + verified.
- app/src/lib/db.ts switched to the Cloud SQL Connector (build passing).
- Exact Vercel env-var changes listed for me to apply (Step 7).
- A short report: what you ran, verification output, and the rollback steps.

Work in small steps. Show me the verification output before recommending the
Vercel cutover.
```
