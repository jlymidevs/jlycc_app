# JLYCC App — Project Handoff

## Project Overview

Church membership, events, and attendance management system for JLY Church.
Two surfaces: **admin portal** (staff, auth-required) and **public church pages** (no auth).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | NextAuth.js v5 (credentials + Google OAuth with DB allowlist) |
| Email | Resend SDK |
| CRM | GoHighLevel (REST, no SDK — `src/lib/ghl.ts`) |
| Validation | Zod |
| Unit Tests | Vitest |
| E2E Tests | Playwright |
| DB Migrations | Flyway (SQL) |

## Important Commands

```bash
# Dev
cd app && npm run dev          # Start dev server (localhost:3000)
cd app && npm run build        # Production build
cd app && npx tsc --noEmit     # TypeScript check

# Tests
cd app && npx vitest run       # Unit tests
cd app && npx playwright test  # E2E tests

# Database (local dev only)
cd db && docker compose up -d  # Start PostgreSQL + run Flyway migrations
```

## Folder Structure

```
JLYCC App/
├── app/                        # Next.js application
│   ├── src/
│   │   ├── actions/            # Server actions (auth, members, events, attendance, registrations)
│   │   ├── app/
│   │   │   ├── (admin)/        # Protected admin routes (members, events, attendance, programs, education, ministries, missions, announcements)
│   │   │   ├── church/         # Public routes (no auth)
│   │   │   │   ├── events/     # Public events list + detail
│   │   │   │   ├── layout.tsx  # Shared public nav
│   │   │   │   └── page.tsx    # Church homepage, hero + 5 upcoming events
│   │   │   ├── portal/[token]/ # Public member self-service portal
│   │   │   ├── login/          # Staff login
│   │   │   └── api/auth/       # NextAuth API route
│   │   ├── components/         # QrScanner, member-form, member-search
│   │   ├── lib/                # auth.ts, db.ts, email.ts, portal-token.ts, validations/
│   │   └── schema/             # Drizzle schemas (core, membership, events, attendance, programs, education, ministries, missions, communications, app)
│   ├── tests/
│   │   ├── e2e/                # Playwright E2E (13 spec files)
│   │   └── unit/               # Vitest unit tests (13 test files, 216 tests)
│   ├── .env.example            # Required env vars template
│   └── drizzle.config.ts
├── db/
│   ├── migrations/             # 75 Flyway SQL migrations (V001–V069) + repeatable seeds
│   └── docker-compose.yml      # Local PostgreSQL 16 + Flyway
├── etl/                        # Python CSV → staging.stg_person loader (uses DATABASE_URL env)
├── JLYCC favicon_io/           # Favicon/PWA icon set (untracked)
└── docs/superpowers/
    ├── plans/                  # Implementation plans (Plans 1–17; 12–16 untracked)
    └── specs/                  # Architecture specs (incl. church calendar design)
```

## Current Progress

### Completed (PRs #1–#12)
- **Plan 1 — Foundation**: DB schema (66 migrations, 10 schemas)
- **Plan 5 — Web App**: Next.js app scaffold, NextAuth, Drizzle, member CRUD (PR #1)
- **Plan 6a — Events**: Event CRUD, registration, organizer assignment (PR #2)
- **Plan 6b — Attendance**: QR scanner, check-in, FTV capture, attendance dashboard (PR #3)
- **Plan 6c — Public Homepage**: `church/layout.tsx` + `church/page.tsx` (PR #4)
- **Plan 7 — Programs / BAC**: Heartlink + BAC admin modules (PR #5)
- **Plan 8 — Education (BC + ISU)**: Bible College + ISU admin modules (PR #6)
- **Plan 9 — Ministries**: networks/ministry/chapter/membership admin module (PR #7)
- **Plan 10 — Scholarships**: missions scholarships CRUD admin module (PR #8)
- **Plan 11 — Membership Extensions**: applications queue, extended member detail (Roles/PCM/Application sections) (PR #9)
- **Plan 12 — Member Self-Service Portal**: `/portal/[token]` public page, portal link on admin member detail (PR #10)
- **Plan 13 — Communications**: announcements module, fan-out recipients, admin pages (PR #11)
- **Plan 14 — Email Delivery**: Resend SDK, email send on publish, `delivered_at` tracking (PR #12)
- **Plan 17 — Church Calendar**: public `/church/calendar` month grid + agenda list, add-to-calendar (Google URL + ICS download route), recurring series admin (create/cancel) materializing WEEKLY/MONTHLY `event` rows ~3 months ahead in Asia/Manila time (PR #13)
- **Plan 18 — Roles & Member Journey**: 4-role access (Super Admin/Admin/Ministry Head/Member), self-signup, universal member profiles (/me), FB-style ministry join requests with priority ranks, head dashboard (/ministry), super-admin user management (/users), head eligibility = Inner Core/Joshua Generation (branch `plan18-roles-member-journey`)
- **Attendance Audit Dashboard** (2026-06-11, branch `attendance-audit-dashboard`, ready for PR): weekly trend stat cards + server-rendered SVG bar chart on `/events/attendance`, "My attendance" section on `/me`. New: `app/src/lib/attendance-trends.ts` (pure helpers, 7 unit tests), `app/src/components/trend-chart.tsx`. Zero new deps, no migrations. Verified 2026-06-11: 278/278 unit tests, tsc clean, prod build clean. Plan: `docs/superpowers/plans/2026-06-11-attendance-audit-dashboard.md`

### Completed after PR #12 (committed directly to master, no PRs)
- **Auth hardening**: middleware now protects ALL admin routes (`b1b6103`) — Plan 16 Task 1 done
- **Google OAuth**: provider added with DB allowlist check (`8bfee2b`)
- **UI overhaul**: dark dashboard redesign + PWA setup (`ff4e77f`), animated splash on root (`bc0f971`), soft teal brand palette (`73f17a5`), split login layout with video panel (`fd6cf70`)
- **GHL integration**: bidirectional contact sync + SMS messaging (`b9672f3`) — `src/lib/ghl.ts`, `src/actions/ghl.ts`, `/ghl` admin page, V067 migration adds `core.person.ghl_contact_id`

### Deployed (2026-06-11)
- **Live on Vercel**: https://jlycc-app-xi.vercel.app (project `jlycc-app`, CLI deploys from `app/`)
- **Neon DB** (prod): migrated through V069, Flyway baselined at 069, lifecycle stages + NCR region + MAIN branch seeded; `admin@jly.church` = SUPER_ADMIN
- **Vercel prod env vars set**: DATABASE_URL(+READER), AUTH_SECRET, RESEND_API_KEY, RESEND_FROM (=onboarding@resend.dev — no verified Resend domain yet), GHL_*, PORTAL_SECRET, AUTH_TRUST_HOST, APP_BASE_URL
- E2E verified vs local DB: roles-journey 4/4, calendar 6/6

### Google OAuth (live 2026-06-11)
- Web OAuth client created in JLYCC Google Cloud project; creds in Vercel prod env + local `app/.env`
- "Continue with Google" on /login + /signup; new Google users → MEMBER + /welcome profile completion
- Old desktop client (`App/JLYCC/client_secrets.json`) is for the YouTube script — NOT usable for web auth

### Accounts (prod, 2026-06-11)
- **SUPER_ADMIN: jlymi.devs@gmail.com** (password set + Google); `admin@jly.church` demoted to ADMIN (V068 seed still names admin@jly.church — prod overridden by data change, fresh local rebuilds get the old super admin)
- 4 other ADMIN accounts are Google-only (no password)

### Remaining (human actions)
- **Resend domain**: verify a sending domain in Resend (DNS), then update `RESEND_FROM` (currently onboarding@resend.dev — test-only sends)

## Git State (as of 2026-06-12)

- **Member Dashboard Redesign: ALL TASKS DONE, ready for push + PR** — branch `member-dashboard-redesign` in worktree `.worktrees/member-dashboard-redesign` (HEAD `0a0403c`, working tree clean, 15 commits ahead of master). Plan: `docs/superpowers/plans/2026-06-11-member-dashboard-redesign.md`.
  - Shared `DashboardShell` (admin + member), `/me` split into Overview/Attendance/Ministries/Announcements, framer-motion widgets, role-filtered nav, E2E `member-dashboard.spec.ts`
  - Verified 2026-06-12: 293/293 unit, tsc + prod build clean, 11/11 E2E (member-dashboard 4, roles-journey 6, admin-smoke) vs local DB, visual check via dev server (admin sidebar, member nav role filter, mobile drawer)
  - Includes fix for stale roles-journey assertion (`Welcome to JLY Church!` → `Welcome to JLYCC!` after branding rename `473c0f1`)
  - **Remaining (needs approval): `git push -u origin member-dashboard-redesign` + open PR to master**
- Main checkout on `master`, **ahead of origin by 2 commits** (redesign spec `f657d1e` + plan `2efd608`) — push when convenient
- PR #14 (attendance-audit-dashboard) merged at `16cf436`; PRs #1–#14 merged. Post-merge hardening on master: middleware cookie security (`8a5aa30`), education redirect-swallow fix (`22bb12d`), db client HMR reuse (`86d75e5`), E2E harness hardening (`8de29b0`), lime ACRU redesign (`61f50d6`), JLYCC branding (`473c0f1`, `eb9fdd2`)
- Untracked: `app/.env` (local secrets — never commit), `JLYCC favicon_io/` (icon source set)
- `.worktrees/`: 3 entries — `member-dashboard-redesign` (ACTIVE), `feature/plan18-roles-member-journey` + `feature/plan9-scholarships` (stale, safe to prune after confirming merged)
- E2E: 13 spec files (some skipped: accumulated test data, QR code)

## Known Issues / Risks

- **Middleware MUST live at `app/src/middleware.ts`** — Next.js ignores `middleware.ts` at the project root when `src/` exists (route guards were silently dead until 2026-06-11). Middleware is edge runtime: decode JWT via `getToken`, never import `@/lib/auth` (postgres driver breaks on edge).
- **Local `.env` points at NEON (prod)** — `npm run dev` and E2E hit prod unless you override: `DATABASE_URL=postgresql://jly_admin:localdevpassword@localhost:5432/jly` (same for `_READER`). Never run Playwright against the Neon URL.
- Flyway-on-Neon: history baselined at 069 via dockerized Flyway; bind-mounting `db/migrations` from Git Bash on Windows may silently mount empty — verify "validated N migrations" count in output.
- `app/.env` exists locally (untracked, now gitignored, contains secrets) — never commit; create from `app/.env.example` on new machines
- GHL Location ID hardcoded as display text in `src/app/(admin)/ghl/page.tsx` (UI only, API uses env var)
- `RESEND_API_KEY` + `RESEND_FROM` must be set in prod env for email delivery to work
- `flyway.conf` + `docker-compose.yml` have hardcoded local dev credentials — do NOT use in production
- `jly-church-db.zip` in root is untracked binary — gitignore or delete; `jly-church-db/` folder is an empty stub
- `CLAUDE.md` at repo root (parent folder) is for a different project (DMerch) — this file is the correct one

## Pending Tasks

1. **Resend domain verification** — see Remaining (human actions) above
2. **Password change UI** — jlymi.devs@gmail.com runs on an agent-issued temp password; no self-service change page exists yet

## Suggested Next Steps

1. **Finish member dashboard redesign Tasks 9–13** (active — see Git State above)
2. Push master (2 unpushed docs commits)
3. Member giving/finance module
4. E2E flaky test investigation (accumulated test data issue)
5. Clean stale `.worktrees/` entries (plan18, plan9-scholarships)

## Safety Notes

- Do NOT delete `db/migrations/` — Flyway is idempotent but history matters
- Do NOT touch `app/src/schema/` without a corresponding migration in `db/migrations/`
- Do NOT commit `.env` files
- `app/.next/` is build output — safe to delete if build issues arise
- All new destructive DB changes need a new versioned migration (V067+)
