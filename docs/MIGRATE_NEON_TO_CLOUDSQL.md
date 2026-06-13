# Runbook: Migrate Database Neon PG18 → GCP Cloud SQL (Postgres)

> **For Codex.** Scope is the **database only**. The app stays on **Vercel** — do NOT touch Vercel hosting, do NOT move to Cloud Run, do NOT change CI/CD. The only app-code change allowed is `app/src/lib/db.ts` (connector wiring) described in Step 6. Keep Neon fully intact until the cutover is verified; Neon is the rollback.

---

## Goal

Move the production database off **Neon (PostgreSQL 18.4)** onto **Google Cloud SQL for PostgreSQL**, owned under the org's Google for Nonprofits GCP project. The Next.js app continues running on Vercel and connects to Cloud SQL via the **Cloud SQL Node Connector** (no public IP, IAM + ephemeral SSL).

---

## Current state (facts)

| Thing | Value |
|---|---|
| App hosting | Vercel (`next build`, no `vercel.json`) |
| Prod DB now | Neon, PostgreSQL **18.4**, host `ep-polished-meadow-ao2y51sb.c-2.ap-southeast-1.aws.neon.tech`, db `neondb`, user `neondb_owner` |
| Neon region | AWS `ap-southeast-1` (Singapore) → Cloud SQL match = `asia-southeast1` |
| App DB access | `app/src/lib/db.ts` uses `drizzle-orm/postgres-js` + `postgres`, reads `process.env.DATABASE_URL` |
| Migrations | Flyway, baseline V069, currently at **V075** on Neon. History in `public.flyway_schema_history` |
| Secrets | `app/.env` locally (gitignored), Vercel env vars in prod. **Never commit secrets.** |

Connection string secret lives in `app/.env` as `DATABASE_URL`. Read it from there; never print the password into logs or commits.

---

## Decisions (already made — do not re-litigate)

1. **Connectivity:** Cloud SQL **Node Connector** (`@google-cloud/cloud-sql-connector`). No public IP for the app path. Service account with `roles/cloudsql.client`.
2. **App stays on Vercel.** Only `db.ts` changes.
3. **Provisioning:** a human runs the `gcloud`/console steps. Codex prepares config + drives the dump/restore + verification.

---

## Prerequisites the human must provide

- A GCP project under the nonprofit org, with **billing enabled** (Google for Nonprofits gives a limited GCP credit grant — confirm it's attached; Cloud SQL is NOT free).
- `gcloud` CLI installed + `gcloud auth login` done, OR willingness to run the console equivalents.
- Confirmed: prod data is the live data we want to copy (we clone it, no data loss).

Set these shell variables once (fill in real values):

```bash
export PROJECT_ID="jlycc-prod"          # your GCP project id
export REGION="asia-southeast1"         # Singapore, matches Neon
export INSTANCE="jlycc-pg"
export DB_NAME="jlycc"                  # app database name on Cloud SQL
export DB_USER="jlycc_app"              # app login role
export DB_PASS="<generate-a-strong-password>"
gcloud config set project "$PROJECT_ID"
```

---

## Step 1 — Enable APIs

```bash
gcloud services enable sqladmin.googleapis.com
```

(`secretmanager.googleapis.com` is optional — not required for this DB-only migration since secrets live in Vercel env.)

---

## Step 2 — Create the Cloud SQL instance

Try Postgres 18 first (matches Neon for a clean logical restore). If `gcloud` rejects `POSTGRES_18` (not yet offered in the region), fall back to `POSTGRES_17` — a logical (`pg_dump`) restore from 18 → 17 works for this schema because it is plain SQL with no 18-only catalog features.

```bash
gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_18 \
  --edition=ENTERPRISE \
  --tier=db-custom-1-3840 \
  --region="$REGION" \
  --storage-auto-increase \
  --availability-type=ZONAL \
  --no-assign-ip            # private path; the Connector does not need a public IP
```

> If `--database-version=POSTGRES_18` errors, re-run with `--database-version=POSTGRES_17`.
> `--no-assign-ip` keeps it off the public internet. The Connector reaches it via the Cloud SQL Admin API. (If the restore in Step 5 needs temporary public access and you don't want to use `gcloud sql import`, you may add `--assign-ip` temporarily, then remove it after.)

Set the built-in `postgres` user password (needed for admin tasks):

```bash
gcloud sql users set-password postgres \
  --instance="$INSTANCE" --password="<postgres-admin-password>"
```

Create the app database and app login role:

```bash
gcloud sql databases create "$DB_NAME" --instance="$INSTANCE"
gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASS"
```

Capture the instance connection name (format `PROJECT:REGION:INSTANCE`) — the app needs it:

```bash
gcloud sql instances describe "$INSTANCE" --format='value(connectionName)'
# e.g. jlycc-prod:asia-southeast1:jlycc-pg
export INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')"
```

---

## Step 3 — Service account for the Connector

```bash
gcloud iam service-accounts create jlycc-cloudsql \
  --display-name="JLYCC app Cloud SQL client"

export SA_EMAIL="jlycc-cloudsql@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

# Key file — store securely, NEVER commit it
gcloud iam service-accounts keys create ./jlycc-cloudsql-key.json \
  --iam-account="$SA_EMAIL"
```

This key JSON goes into Vercel env in Step 7. Delete the local copy afterward.

---

## Step 4 — Fresh dump of Neon (current = V075)

Take a brand-new full dump (schema + data + `flyway_schema_history`) of live Neon. Use the `postgres:18` Docker image (server is PG18; older `pg_dump` refuses with a version mismatch). Stream to a file to avoid Windows path-mount issues.

```bash
cd "JLYCC App"
URL=$(grep -m1 '^DATABASE_URL=' app/.env | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
docker run --rm -i postgres:18 pg_dump --no-owner --no-privileges "$URL" \
  > backups/neon-prod-cloudsql-migration.sql
wc -c < backups/neon-prod-cloudsql-migration.sql   # sanity: non-zero
```

Notes:
- `--no-owner --no-privileges` strips Neon-specific role grants so it restores cleanly under the Cloud SQL app user.
- Neon prod does **not** have the `pgtap` extension (that's local-dev only), so the dump won't reference it. If the dump references any extension (`uuid-ossp`, `pgcrypto`, etc.), note them — Cloud SQL supports the common ones but they may need `CREATE EXTENSION` privileges; the dump's `CREATE EXTENSION` lines normally handle this.
- `backups/` holds real prod data — keep local, **do not commit**. Confirm it is gitignored.

---

## Step 5 — Restore into Cloud SQL

Two options. **Prefer 5A** (`gcloud sql import`) — no local network path to the instance needed.

### 5A. Import via GCS (recommended)

```bash
# one-time bucket
gsutil mb -l "$REGION" "gs://${PROJECT_ID}-db-import"
gsutil cp backups/neon-prod-cloudsql-migration.sql "gs://${PROJECT_ID}-db-import/"

# grant the instance's service account read on the object
export SQL_SA="$(gcloud sql instances describe "$INSTANCE" --format='value(serviceAccountEmailAddress)')"
gsutil iam ch "serviceAccount:${SQL_SA}:objectViewer" "gs://${PROJECT_ID}-db-import"

gcloud sql import sql "$INSTANCE" \
  "gs://${PROJECT_ID}-db-import/neon-prod-cloudsql-migration.sql" \
  --database="$DB_NAME"
```

Delete the bucket object after a successful import (it contains prod data).

### 5B. Direct psql restore (only if not using GCS)

Temporarily `--assign-ip` the instance + add your current IP as an authorized network, then:

```bash
HOST="$(gcloud sql instances describe "$INSTANCE" --format='value(ipAddresses[0].ipAddress)')"
docker run --rm -i postgres:18 psql \
  "postgresql://${DB_USER}:${DB_PASS}@${HOST}:5432/${DB_NAME}?sslmode=require" \
  < backups/neon-prod-cloudsql-migration.sql
```

Then remove the public IP / authorized network again.

---

## Step 6 — App code change (`app/src/lib/db.ts`)

Switch the driver to `pg` (node-postgres) so the Cloud SQL Connector can supply the socket. Drizzle works the same via `drizzle-orm/node-postgres`.

Install deps (in `app/`):

```bash
cd app
npm install @google-cloud/cloud-sql-connector pg
npm install -D @types/pg
```

Replace `app/src/lib/db.ts` with:

```ts
// app/src/lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Connector, IpAddressTypes, AuthTypes } from "@google-cloud/cloud-sql-connector";
import * as core from "@/schema/core";
import * as membership from "@/schema/membership";
import * as app from "@/schema/app";

// Reuse one pool + connector across dev HMR / serverless warm invocations.
const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
  connector?: Connector;
};

function makePool(): Pool {
  // Fallback: if DATABASE_URL is set (e.g. local dev against Docker/Neon),
  // use it directly and skip the Cloud SQL Connector.
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }

  const connector = globalForDb.connector ?? new Connector();
  globalForDb.connector = connector;

  // getOptions is async in the connector; we resolve it synchronously at module
  // init via a cached promise pattern. pg.Pool accepts a `Client`-less options
  // object once getOptions resolves, so we await it here.
  throw new Error(
    "Cloud SQL Connector requires async init — see initDb() below"
  );
}

// Cloud SQL Connector needs async setup. Export a ready promise.
async function buildPool(): Promise<Pool> {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  const connector = globalForDb.connector ?? new Connector();
  globalForDb.connector = connector;

  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME!,
    ipType: IpAddressTypes.PRIVATE,
    authType: AuthTypes.PASSWORD,
  });

  return new Pool({
    ...clientOpts,
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    database: process.env.DB_NAME!,
    max: 5,
  });
}

const poolPromise: Promise<Pool> =
  (globalForDb.pgPool && Promise.resolve(globalForDb.pgPool)) ||
  buildPool().then((p) => {
    if (process.env.NODE_ENV !== "production") globalForDb.pgPool = p;
    return p;
  });

// Drizzle needs a pool synchronously; we wrap with a thin async accessor.
// Most call sites do `await db...` already since queries are async.
export const db = drizzle(await poolPromise, {
  schema: { ...core, ...membership, ...app },
});
```

> **Codex caution:** top-level `await` requires the module to be ESM and may need `tsconfig`/Next config support. If top-level await is rejected by the build, refactor to an async `getDb()` accessor and update import sites, OR keep `postgres-js` and instead point `DATABASE_URL` at a Cloud SQL **public IP + SSL** connection string (only if the team accepts a public IP). Decide based on what builds cleanly; do NOT ship a broken build. Verify with `cd app && npx tsc --noEmit && npm run build` before cutover.

The `makePool()` stub above is illustrative — delete it; only `buildPool()` is used.

---

## Step 7 — Vercel environment variables

In the Vercel project settings (Production), add:

| Var | Value |
|---|---|
| `INSTANCE_CONNECTION_NAME` | `jlycc-prod:asia-southeast1:jlycc-pg` (from Step 2) |
| `DB_USER` | `jlycc_app` |
| `DB_PASS` | the app password from Step 2 |
| `DB_NAME` | `jlycc` |
| `GOOGLE_APPLICATION_CREDENTIALS` | path written at runtime, see below |
| `GCP_SA_KEY_B64` | base64 of `jlycc-cloudsql-key.json` |

And **remove / unset `DATABASE_URL`** in Production (so the code path uses the Connector, not the old Neon string). Keep the Neon `DATABASE_URL` value saved somewhere for rollback.

Because Vercel can't store a file, write the SA key at runtime. Add to the top of `app/src/lib/db.ts` (or an instrumentation/bootstrap module) — guarded so it runs once:

```ts
import { writeFileSync, existsSync } from "node:fs";
if (process.env.GCP_SA_KEY_B64 && !existsSync("/tmp/sa.json")) {
  writeFileSync("/tmp/sa.json", Buffer.from(process.env.GCP_SA_KEY_B64, "base64"));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/sa.json";
}
```

Local dev keeps `DATABASE_URL` in `app/.env` → code uses the direct-connection fallback, no Connector needed locally.

---

## Step 8 — Verify Cloud SQL contents before cutover

Run against Cloud SQL (via 5B-style temporary connection or `gcloud sql connect`):

```sql
SELECT to_regclass('ministries.network_leader') IS NOT NULL AS network_leader_ok;
SELECT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='ministries' AND table_name='ministry_membership'
  AND column_name='is_inner_core') AS is_inner_core_ok;
SELECT string_agg(name,', ' ORDER BY name) AS networks FROM ministries.network;
SELECT count(*) AS ministry_count FROM ministries.ministry;
SELECT count(*) AS active_chapters FROM ministries.ministry_chapter WHERE status='ACTIVE';
SELECT max(version) AS flyway_version FROM public.flyway_schema_history;
```

**Expected:** `network_leader_ok = t`, `is_inner_core_ok = t`, networks = `Eagles, Wave, Wind`, ministry_count = 17, active_chapters = 17, flyway_version = `075`.

Cross-check row counts against Neon for the big tables (e.g. `core.person`, `membership.member`) to confirm the data copied fully.

---

## Step 9 — Cutover

1. Deploy the `db.ts` change + new env vars to Vercel (push to `master` or redeploy).
2. Load `https://app.jlycc.org/ministries` (logged in as admin) — page renders, no 500.
3. Smoke-test a couple of other DB-backed pages (`/members`, `/events`).
4. Watch Vercel logs for connection errors for a few minutes.

---

## Step 10 — Rollback (if anything fails)

1. In Vercel, restore `DATABASE_URL` to the Neon value and re-add the `postgres-js` `db.ts` (revert the commit).
2. Redeploy. App is back on Neon within one deploy.

Keep Neon running and untouched until Cloud SQL has been stable for at least a few days.

---

## Rules

1. **DB only.** Do not change Vercel hosting, Cloud Run, or CI/CD.
2. Secrets via env / `gcloud` only — never commit `app/.env`, the SA key JSON, or any password. Confirm `backups/` and `*.json` keys are gitignored.
3. Do not delete or edit any `V0xx` migration file.
4. Do not drop Neon until Cloud SQL is verified stable.
5. `cd app && npx tsc --noEmit && npm run build` must pass before cutover. Never ship a broken build.
6. If `POSTGRES_18` is unavailable in the region, use `POSTGRES_17` and confirm the logical restore succeeds.
7. If anything in `flyway info` / verification is unexpected, STOP and report instead of forcing the cutover.
```
