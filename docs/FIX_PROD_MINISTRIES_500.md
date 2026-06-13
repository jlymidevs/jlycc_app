# Fix: Prod `/ministries` 500 (digest 4230879761)

> **For Codex:** This is a DB-state fix, NOT a code fix. Do not change any `app/` code or edit any migration file. The deployed code is correct — Neon prod is just missing migrations.

---

## Symptom

`https://app.jlycc.org/ministries` returns:

```
Application error: a server-side exception has occurred (see the server logs for more information).
Digest: 4230879761
```

---

## Root Cause

Vercel auto-deployed the ministries-leaders redesign on push to `master`. The new code queries database objects that do **not** exist on Neon prod yet:

| Code reference | File | Needs migration |
|---|---|---|
| `SELECT … FROM ministries.network_leader` | `app/src/actions/ministry-leaders.ts:95` | **V073** |
| filter on `ministry_membership.is_inner_core` | `app/src/actions/ministry-leaders.ts:166` | **V074** |

`/ministries/page.tsx` calls `getLeadersSidebarData()` in `Promise.all` on every page load. Missing table/column → unhandled throw → 500.

**Why Neon is behind:** the Vercel build command is `next build` only (`app/package.json`). There is no `vercel.json`, no CI workflow, and no Flyway step on deploy. Migrations against Neon are 100% manual and were never run for V070–V075.

### Confirm (optional, 30 sec)

Vercel → project → **Logs** → open the errored request. Expect literally:

```
relation "ministries.network_leader" does not exist
```
or
```
column ministry_membership.is_inner_core does not exist
```

---

## Pending migrations on Neon

These are committed in `db/migrations/` but not applied to Neon:

| Migration | What it does |
|---|---|
| `V070__profile_completed_network_head_role.sql` | Adds `profile_completed_at`, expands role check to include `NETWORK_HEAD` |
| `V071__ministries_network_leader.sql` | Creates `ministries.network_leader` table |
| `V072__users_last_login_archived.sql` | Adds user last-login / archived columns |
| `V073__ministries_network_leader.sql` | Adds CASCADE FKs to `network_leader` |
| `V074__ministry_membership_inner_core.sql` | Adds `is_inner_core` column |
| `V075__seed_overhaul_networks_ministries.sql` | **DESTRUCTIVE** — wipes + reseeds networks/ministries/chapters |

Plus repeatable seeds (`R__seed_networks.sql`, `R__seed_networks_ministries.sql`, `R__seed_chapters.sql`, `R__seed_zz_event_types.sql`) re-run automatically because their checksums changed.

---

## ⚠️ DESTRUCTIVE WARNING — read before running

`V075` runs:

```sql
UPDATE events.event_type SET ministry_id = NULL, network_id = NULL
  WHERE ministry_id IS NOT NULL OR network_id IS NOT NULL;
DELETE FROM ministries.ministry_chapter;
DELETE FROM ministries.ministry;
DELETE FROM ministries.network;
```

This **erases all existing networks, ministries, and chapters on Neon** and reseeds the real Wind/Wave/Eagles structure (17 ministries). The `event_type` ministry/network links are nulled then repopulated by `R__seed_zz_event_types.sql` in the same migrate run.

Only proceed if prod ministries data is disposable (confirmed: prod is fresh, no real ministry members).

This is irreversible. If unsure whether prod has real data, take a Neon branch/backup first.

---

## Fix Procedure

### 1. Get Neon credentials

From Vercel → project → Settings → Environment Variables → `DATABASE_URL`, or the Neon dashboard.

Convert the connection string to JDBC form:

```
jdbc:postgresql://<NEON_HOST>/<DB_NAME>?sslmode=require
```

`sslmode=require` is mandatory for Neon.

### 2. Dry-run — list pending migrations (no changes)

```bash
cd db
docker compose run --rm \
  -e FLYWAY_URL="jdbc:postgresql://<NEON_HOST>/<DB>?sslmode=require" \
  -e FLYWAY_USER="<NEON_USER>" \
  -e FLYWAY_PASSWORD="<NEON_PASSWORD>" \
  flyway info
```

**Expected:** V070–V075 shown as `Pending`. If the pending set is different (e.g. some already applied, or earlier versions missing), **STOP and report** before applying.

### 3. Apply migrations

```bash
docker compose run --rm \
  -e FLYWAY_URL="jdbc:postgresql://<NEON_HOST>/<DB>?sslmode=require" \
  -e FLYWAY_USER="<NEON_USER>" \
  -e FLYWAY_PASSWORD="<NEON_PASSWORD>" \
  flyway migrate
```

If it aborts with a **checksum / validation error** on `R__` repeatable seeds, run `repair` first, then re-run `migrate`:

```bash
docker compose run --rm \
  -e FLYWAY_URL="jdbc:postgresql://<NEON_HOST>/<DB>?sslmode=require" \
  -e FLYWAY_USER="<NEON_USER>" \
  -e FLYWAY_PASSWORD="<NEON_PASSWORD>" \
  flyway repair
# then migrate again
```

### 4. Verify migration state

```bash
docker compose run --rm \
  -e FLYWAY_URL="jdbc:postgresql://<NEON_HOST>/<DB>?sslmode=require" \
  -e FLYWAY_USER="<NEON_USER>" \
  -e FLYWAY_PASSWORD="<NEON_PASSWORD>" \
  flyway info
```

**Expected:** V070–V075 all `Success`.

### 5. Verify the page

Reload `https://app.jlycc.org/ministries`. The 500 should be gone. Page shows Wind / Wave / Eagles with 17 ministries and the leaders sidebar.

---

## Rules

1. Neon credentials via **env vars only** — never write them into `db/flyway.conf`, never commit them.
2. Do **not** edit any `V0xx` migration file.
3. Do **not** modify any `app/` code — the code is correct; this is a schema-state fix.
4. If `flyway info` shows an unexpected pending set, STOP and report instead of forcing `migrate`.
