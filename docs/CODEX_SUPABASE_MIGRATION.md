# Codex Runbook — Migrate Database Neon PG18 → Supabase

This single file is everything Codex needs: the **prompt** to start with (Part 1) and the **step-by-step runbook** it must follow (Part 2). Hand this whole file to Codex.

---

## PART 1 — Prompt (copy-paste to Codex)

Fill in the `<...>` placeholders first, then paste the block below.

```
You are working in the JLYCC App repo (Next.js on Vercel, Postgres DB).

TASK: Migrate the production database from Neon (PostgreSQL 18.4) to a managed
Supabase Postgres project. This is DATABASE-ONLY. The app stays on Vercel —
do NOT touch Vercel hosting or CI/CD. NO app-code change is needed: the app
reads process.env.DATABASE_URL, so this is dump → restore → env swap.

SOURCE OF TRUTH: Follow PART 2 of docs/CODEX_SUPABASE_MIGRATION.md exactly,
step by step (Steps 1–6). Do not skip or reorder steps. If that file is not
present, check out branch `docs/cloudsql-migration-runbook` first.

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
5. Use the postgres:18 Docker image for pg_dump/psql (Neon is PG18).
6. Restore via the DIRECT (5432) string, not the pooler.
7. After restore, verify (Step 4): network_leader table exists, is_inner_core
   column exists, networks = Eagles/Wave/Wind, 17 ministries, 17 active
   chapters, flyway version = 075. Cross-check row counts vs Neon.
8. If the restore reports real errors (not just "already exists"), or if
   verification is unexpected, STOP and report — do not force the cutover.

DELIVERABLES:
- Supabase project restored + verified.
- The exact DATABASE_URL value (pooler 6543) for me to set in Vercel.
- A short report: what you ran, verification output, and rollback steps.

Work in small steps. Show me the verification output before recommending the
Vercel DATABASE_URL swap.
```

---

## PART 2 — Runbook (Codex follows this)

> Scope is the **database only**. The app stays on **Vercel** — do NOT touch Vercel hosting or CI/CD. **No app-code change is needed**: the app reads `process.env.DATABASE_URL`, so the migration is dump → restore → env swap. Keep Neon fully intact until the cutover is verified; Neon is the rollback.

### Goal

Move the production database off **Neon (PostgreSQL 18.4)** onto a managed **Supabase** Postgres project. The Next.js app keeps running on Vercel and connects through Supabase's **transaction pooler** connection string.

### Current state (facts)

| Thing | Value |
|---|---|
| App hosting | Vercel (`next build`, no `vercel.json`) |
| Prod DB now | Neon, PostgreSQL **18.4**, host `ep-polished-meadow-ao2y51sb.c-2.ap-southeast-1.aws.neon.tech`, db `neondb`, user `neondb_owner` |
| Neon region | AWS `ap-southeast-1` (Singapore) → match Supabase region = **Southeast Asia (Singapore)** |
| App DB access | `app/src/lib/db.ts` uses `drizzle-orm/postgres-js` + `postgres`, reads `process.env.DATABASE_URL`, already sets `prepare: false` |
| Migrations | Flyway, baseline V069, currently at **V075** on Neon. History in `public.flyway_schema_history` |
| Secrets | `app/.env` locally (gitignored), Vercel env vars in prod. **Never commit secrets.** |

`prepare: false` in `db.ts` is exactly what Supabase's transaction pooler requires — so **no code change**. The dump already carries the full schema + `flyway_schema_history`, so Supabase lands at V075 immediately; Flyway is only needed for *future* migrations.

### Decisions (already made — do not re-litigate)

1. **Target:** Supabase managed Postgres (new project).
2. **App stays on Vercel.** No `db.ts` change — just swap `DATABASE_URL`.
3. **Connection:** app uses the **transaction pooler** string (port `6543`); the **direct** string (port `5432`) is used for the restore and any future Flyway runs.

### Prerequisites the human must provide

- A Supabase account/org for JLYCC.
- A created project + its connection strings and DB password (Step 1).
- Confirmed: prod data on Neon is the live data we want to clone (no data loss; we copy).

---

### Step 1 — Create the Supabase project

In the Supabase dashboard → **New project**:
- **Region:** Southeast Asia (Singapore) — matches Neon for latency.
- **Postgres version:** pick the **newest offered** (17 if available). Logical restore from Neon 18 → 17 works for this schema (plain SQL, no 18-only catalog features). If only 15 is offered, proceed but watch the restore for any 18-specific syntax errors.
- Set a **strong database password** and save it.

From **Project Settings → Database → Connection string**, copy both and export (fill in real values; never print/commit the password):

```bash
export SUPA_DIRECT="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require"
export SUPA_POOLER="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
```

### Step 2 — Fresh dump of Neon (current = V075)

Full dump (schema + data + `flyway_schema_history`) of live Neon via the `postgres:18` image (Neon server is PG18; older `pg_dump` refuses with a version mismatch). Stream to a file to avoid Windows path-mount issues.

```bash
cd "JLYCC App"
URL=$(grep -m1 '^DATABASE_URL=' app/.env | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
docker run --rm -i postgres:18 pg_dump --no-owner --no-privileges "$URL" \
  > backups/neon-prod-supabase-migration.sql
wc -c < backups/neon-prod-supabase-migration.sql   # sanity: non-zero
```

Notes:
- `--no-owner --no-privileges` strips Neon-specific role grants so it restores cleanly under Supabase's `postgres` role.
- Neon prod does **not** have `pgtap` (local-dev only), so the dump won't reference it.
- If the dump contains `CREATE EXTENSION` lines (`uuid-ossp`, `pgcrypto`, …), Supabase supports the common ones; they should restore fine.
- `backups/` holds real prod data — keep local, **do not commit** (already gitignored).

### Step 3 — Restore into Supabase

Use the **DIRECT** connection (port 5432) — the pooler (6543, transaction mode) cannot run a full restore reliably.

```bash
docker run --rm -i postgres:18 psql "$SUPA_DIRECT" \
  -v ON_ERROR_STOP=0 \
  < backups/neon-prod-supabase-migration.sql 2>&1 | tail -40
```

> `ON_ERROR_STOP=0` lets it continue past harmless "already exists" notices on `public`/`schema` objects Supabase pre-creates. Review the tail: real errors (missing extension, failed COPY) must be investigated, not ignored. If a `CREATE EXTENSION` fails, create it in the Supabase SQL editor and re-run only the affected part.

### Step 4 — Verify Supabase contents before cutover

Run against the DIRECT connection:

```bash
docker run --rm -i postgres:18 psql "$SUPA_DIRECT" -At -c "
SELECT 'network_leader_ok', to_regclass('ministries.network_leader') IS NOT NULL;
SELECT 'is_inner_core_ok', EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='ministries' AND table_name='ministry_membership' AND column_name='is_inner_core');
SELECT 'networks', string_agg(name,', ' ORDER BY name) FROM ministries.network;
SELECT 'ministry_count', count(*)::text FROM ministries.ministry;
SELECT 'active_chapters', count(*)::text FROM ministries.ministry_chapter WHERE status='ACTIVE';
SELECT 'flyway_version', max(version) FROM public.flyway_schema_history;
"
```

**Expected:** `network_leader_ok|t`, `is_inner_core_ok|t`, networks = `Eagles, Wave, Wind`, ministry_count = `17`, active_chapters = `17`, flyway_version = `075`.

Cross-check row counts vs Neon for the big tables (e.g. `core.person`, `membership.member`) to confirm the data copied fully.

Optional — confirm Flyway agrees (future migrations use `$SUPA_DIRECT`):

```bash
cd db
docker compose run --rm \
  -e FLYWAY_URL="jdbc:postgresql://db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require" \
  -e FLYWAY_USER="postgres" -e FLYWAY_PASSWORD="[PASSWORD]" \
  flyway info | tail -10   # expect V075 Success
```

### Step 5 — Cutover (swap DATABASE_URL in Vercel)

1. In Vercel project settings (Production), set `DATABASE_URL` to the **TRANSACTION POOLER** string (`$SUPA_POOLER`, port 6543). Keep the Neon value saved for rollback.
2. Redeploy (push to `master` or trigger redeploy).
3. Load `https://app.jlycc.org/ministries` (logged in as admin) — page renders, no 500.
4. Smoke-test other DB-backed pages (`/members`, `/events`).
5. Watch Vercel logs for connection errors for a few minutes.

> Use the **pooler (6543)** string for the app, NOT the direct (5432) one — serverless functions open many short-lived connections and would exhaust direct connections.

### Step 6 — Rollback (if anything fails)

1. In Vercel, restore `DATABASE_URL` to the Neon value.
2. Redeploy. App is back on Neon within one deploy.

Keep Neon running and untouched until Supabase has been stable for at least a few days.

---

## Rules

1. **DB only.** Do not change Vercel hosting or CI/CD. No `db.ts` change needed.
2. Secrets via env only — never commit `app/.env`, any password, or DB dumps in `backups/`. Confirm they stay gitignored.
3. Do not delete or edit any `V0xx` migration file.
4. Do not drop Neon until Supabase is verified stable.
5. App `DATABASE_URL` = pooler (6543). Restore + Flyway = direct (5432).
6. If the restore reports real errors (not just "already exists"), STOP and report.
7. If verification (Step 4) is unexpected, STOP and report — do not force the cutover.
```
