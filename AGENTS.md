# JLYCC App — Project Handoff

## Project Overview

JLYCC App is a church operations platform for JLY Church.

It appears to combine:
- a **staff/admin portal** for membership, ministries, events, attendance, programs, education, missions, announcements, and user management
- a **member-facing surface** (`/me`, `/portal/[token]`, `/welcome`, `/signup`)
- a **public church site** (`/church`, `/church/events`, `/church/calendar`)
- a **PostgreSQL/Flyway database layer** with extensive SQL migrations and pgTAP-style DB tests
- a small **Python ETL/staging loader** for CSV import into the `staging` schema

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / App | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Animation | framer-motion |
| Auth | NextAuth.js v5 beta |
| Validation | Zod |
| ORM / DB access | Drizzle ORM + `postgres` |
| Database | PostgreSQL 16 |
| Migrations | Flyway SQL |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Email | Resend |
| CRM integration | GoHighLevel REST integration |
| ETL | Python (`psycopg2`, `pandas`, `gspread`) |
| Package manager | npm (`app/package-lock.json` present) |
| Deployment target | Vercel app + Neon Postgres are referenced in docs/history |

## Important Commands

### App
```bash
cd app
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
npx vitest run
npx playwright test
```

### Database
```bash
cd db
docker compose up -d postgres
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

### ETL
```bash
cd etl
python loader.py --csv path/to/file.csv
```

## Folder Structure Summary

```text
JLYCC App/
├── app/                      # Next.js application
│   ├── src/
│   │   ├── actions/         # Server actions for major modules
│   │   ├── app/             # App Router pages and route groups
│   │   ├── components/      # Shared UI components
│   │   ├── lib/             # Auth, DB, helpers, validation, integrations
│   │   └── schema/          # Drizzle schema definitions
│   ├── tests/
│   │   ├── e2e/             # Playwright specs
│   │   └── unit/            # Vitest unit tests
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── tailwind.config.ts
│   └── drizzle.config.ts
├── db/
│   ├── migrations/          # Flyway migrations + repeatable seeds
│   ├── staging/             # Standalone SQL staging pipeline scripts
│   ├── tests/               # DB test SQL + run_tests.sh
│   ├── docker-compose.yml
│   ├── flyway.conf
│   └── README.md
├── docs/
│   └── superpowers/
│       ├── plans/           # Implementation plans / handoff plans
│       ├── specs/           # Design specs
│       └── screenshots/     # UI screenshots
├── etl/                     # Python CSV → staging loader
├── JLYCC favicon_io/        # Favicon source assets (currently untracked)
├── .worktrees/              # Local git worktree folders
└── AGENTS.md                # This handoff file
```

## Main Modules / Features Observed

### Admin / staff areas
- Members CRUD, edit, applications queue, trash / restore flow
- Events CRUD, registrations, attendance, recurring series
- Programs: Heartlink and BAC
- Education: BC and ISU
- Ministries and chapter membership management
- Missions scholarships
- Announcements / communications
- GHL integration page
- Users / roles / activation
- Network dashboard (`/network`)

### Member-facing areas
- `/me` dashboard
- `/me/attendance`
- `/me/ministries`
- `/me/announcements`
- `/me/calendar`
- `/welcome`
- `/signup`
- `/portal/[token]`

### Public-facing areas
- `/church`
- `/church/events`
- `/church/calendar`
- `/church/events/[id]`
- ICS / add-to-calendar flow is referenced in docs and route structure

### Database domains present in schema/migrations
- `core`
- `membership`
- `ministries`
- `events`
- `attendance`
- `programs`
- `education`
- `missions`
- `communications`
- `app`
- `staging`

## Current State of Progress

### Clearly implemented on current `master`
Evidence from routes, actions, schema, tests, and recent git history indicates these are already present:
- Core app scaffold and auth system
- Member management including trash / restore / purge
- Events, registrations, attendance, and calendar pages
- Programs, education, scholarships, ministries modules
- Announcements / email integration
- Public church pages and member dashboard areas
- User management page
- Recent DB work for `V070`–`V074` has been committed on `master`

### In progress / partial on current working tree
There is active unfinished work around the ministries leaders redesign:
- Untracked file: `app/src/actions/ministry-leaders.ts`
- Untracked tests:
  - `app/tests/unit/ministry-leaders.test.ts`
  - `app/tests/unit/stage-promotion.test.ts`
- Existing ministries page is still the older simple grouped-card layout:
  - `app/src/app/(admin)/ministries/page.tsx`
- The redesign plan/spec exist:
  - `docs/superpowers/specs/2026-06-12-ministries-leaders-redesign.md`
  - `docs/superpowers/plans/2026-06-12-ministries-leaders-redesign.md`

### Important branch/worktree context visible from git history
A separate feature branch exists with much more appointment-hierarchy work:
- `feature/profile-appointment-hierarchy`
- visible commits include:
  - `feat(users): appoint/remove network heads with role sync`
  - `feat(network-head): dashboard with scoped ministry-head appointment`
  - `feat(ministry): one-step stage promotion up to Inner Core`
  - related E2E and user-context commits

That means current `master` contains only part of that broader feature set, while the feature branch appears materially ahead in appointment-chain implementation.

## Git State (audited now)

### Branch / ahead status
- Current branch: `master`
- Status: `master...origin/master [ahead 4]`

### Modified files
- `.Codex/launch.json`
- `AGENTS.md`

### Untracked files
- `app/src/actions/ministry-leaders.ts`
- `app/tests/unit/ministry-leaders.test.ts`
- `app/tests/unit/stage-promotion.test.ts`

### Recent commits on `master`
- `f104a31` — `feat(db): V074 is_inner_core column; Drizzle networkLeader table + isInnerCore field`
- `db91a20` — `feat(db): V073 ministries.network_leader appointment table`
- `a9bdbac` — ministries leaders redesign plan doc
- `9d792cf` — ministries leaders redesign spec doc
- `f6a55c3` — member trash / restore / purge

### Important recent-history observation
Commit `db91a20` added `V070`, `V071`, `V072`, and `V073` migrations to `master`, but the corresponding app-layer implementation is not fully present on `master`.

## Technical Health Check

### Dependency / script status
- `npm run lint` currently succeeds with no ESLint errors.
- TypeScript is **not** clean right now.
- Unit tests are **not** clean right now.

### Verified issues found during audit

#### 1) Missing file breaks typecheck
Verified via `npx tsc --noEmit`:
- `tests/unit/stage-promotion.test.ts` imports `@/lib/stage-promotion`
- `app/src/lib/stage-promotion.ts` does **not** exist
- current TypeScript error:
  - `TS2307: Cannot find module '@/lib/stage-promotion'`

#### 2) New ministry-leaders unit test is not runnable as written
Verified via Vitest:
- `tests/unit/ministry-leaders.test.ts` imports from `@/actions/ministry-leaders`
- that action file drags in app/server auth dependencies
- Vitest currently fails with:
  - `Cannot find module '.../node_modules/next/server' imported from next-auth/lib/env.js`

This suggests the pure helper under test should likely be moved into a dependency-light helper module, or the test harness needs a safer boundary.

#### 3) Schema / app-state mismatch around role hierarchy
Current app role ladder still reflects only four roles:
- `app/src/lib/authz.ts` roles = `MEMBER`, `MINISTRY_HEAD`, `ADMIN`, `SUPER_ADMIN`
- `app/src/components/user-role-controls.tsx` role options also omit `NETWORK_HEAD`
- `app/src/middleware.ts` has no `NETWORK_HEAD` route handling

But `db/migrations/V070__profile_completed_network_head_role.sql` expands the DB role check to include `NETWORK_HEAD`.

This means database migrations on `master` are ahead of current app-layer role handling.

#### 4) `profile_completed_at` migration is present, but app schema / usage are not fully aligned on `master`
- `V070__profile_completed_network_head_role.sql` adds `app.users.profile_completed_at`
- current `app/src/schema/app.ts` does **not** expose `profileCompletedAt`
- current search of app code did not show active runtime use of `profileCompletedAt`

So part of the welcome/profile-completion feature was merged into migrations, but not fully into current `master` app code.

#### 5) Duplicate / overlapping network leader migrations exist
Current migration set includes both:
- `V071__ministries_network_leader.sql` — creates `ministries.network_leader`
- `V073__ministries_network_leader.sql` — alters/re-adds FKs and comments on the same table

This may be intentional as a follow-up migration, but it is easy to misread and should be treated carefully when continuing migration work.

#### 6) Existing ministries page does not yet match approved redesign docs
- Current page is a simple grouped card list
- Approved design expects a 2-column ministries + leaders layout with appointment controls

#### 7) `ministries.ts` action file contains multiple `as any` / `eslint-disable` suppressions
These are not immediate build failures, but they are risk markers for future refactors and type drift.

## Tests Present

### App tests
- Unit tests: 27 files currently detected under `app/tests/unit`
- E2E tests: 15 Playwright spec files detected under `app/tests/e2e`

### DB tests
- 58 SQL test files detected under `db/tests`
- `db/tests/run_tests.sh` executes all SQL files inside the Docker Postgres container

### What was actually run in this audit
Ran successfully:
- `npm run lint`

Ran and failed:
- `npx tsc --noEmit`
- `npx vitest run tests/unit/ministry-leaders.test.ts tests/unit/stage-promotion.test.ts`

Not run during this audit:
- full app build
- full unit test suite
- Playwright suite
- DB migration / DB tests

## Config / Environment / Deployment Files Observed

### App config
- `app/package.json`
- `app/tsconfig.json`
- `app/next.config.mjs`
- `app/drizzle.config.ts`
- `app/playwright.config.ts`
- `app/vitest.config.ts`
- `app/tailwind.config.ts`
- `app/postcss.config.mjs`
- `app/.eslintrc.json`
- `app/.env.example`

### DB / infra config
- `db/docker-compose.yml`
- `db/flyway.conf`
- many Flyway migration files in `db/migrations/`

### Deployment references
- No `vercel.json` found in `app/`
- deployment to Vercel and Neon is documented in plans / prior handoff notes, but configuration appears to rely on environment/platform settings rather than repo-local config files

## Known Issues / Risks

- Local untracked app work exists; do not overwrite it blindly.
- Current `master` appears to contain **partial merge state** from the appointment-hierarchy effort.
- Database migrations and application code are currently **out of sync** in some areas (`NETWORK_HEAD`, `profile_completed_at`).
- `app/.env` likely exists locally and is intentionally untracked; never commit env files.
- `db/docker-compose.yml` and `db/flyway.conf` contain hardcoded local-dev credentials; local-only.
- There is a parent-folder `AGENTS.md` for a different project; ignore it and use this file.
- `.worktrees/` exists locally; do not delete or prune without confirming which worktrees are still needed.
- Playwright config intentionally forces local DB URLs for E2E; preserve that safety behavior.

## Pending Tasks / Likely Next Work Areas

### Highest-confidence unfinished work
1. Finish the ministries leaders redesign on top of current documented plan
2. Resolve the missing `stage-promotion` helper / tests
3. Reconcile role hierarchy across DB migrations, authz helpers, middleware, and user role controls
4. Decide whether to continue from current `master` or port/cherry-pick from `feature/profile-appointment-hierarchy`

### Secondary follow-up areas
- Verify whether `profile_completed_at` should be restored into current app schema and `/welcome` flow on `master`
- Verify `/network` vs future `/network-head` route strategy
- Run broader verification after the above is reconciled:
  - typecheck
  - targeted Vitest
  - full Vitest
  - build
  - then E2E on local DB only

## Suggested Next Steps

Safest continuation path:

1. **Do not start coding blindly on current `master`.**
2. First compare current `master` with `feature/profile-appointment-hierarchy` for these files/areas:
   - authz role ladder
   - middleware
   - users role controls
   - network / ministry head actions
   - stage promotion helper
   - `/network-head` dashboard
3. Decide whether to:
   - cherry-pick missing commits from the feature branch, or
   - re-implement only the needed pieces on `master`
4. Only after that, continue the ministries leaders redesign and fix the broken tests.

## Safety Notes Before Making Changes

- Do **not** delete migrations.
- Do **not** change `app/src/schema/*` without corresponding migration awareness.
- Do **not** run E2E against production / Neon URLs.
- Do **not** commit `.env` files or other secrets.
- Do **not** discard untracked work until it has been reviewed.
- Treat `V070`–`V074` as partially integrated work; verify app-layer parity before extending them.
- Prefer small, reviewable steps: inspect → reconcile branch differences → fix type/test blockers → continue feature work.
