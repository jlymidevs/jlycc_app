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
│   ├── migrations/             # 73 Flyway SQL migrations (V001–V067) + repeatable seeds
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

### Completed after PR #12 (committed directly to master, no PRs)
- **Auth hardening**: middleware now protects ALL admin routes (`b1b6103`) — Plan 16 Task 1 done
- **Google OAuth**: provider added with DB allowlist check (`8bfee2b`)
- **UI overhaul**: dark dashboard redesign + PWA setup (`ff4e77f`), animated splash on root (`bc0f971`), soft teal brand palette (`73f17a5`), split login layout with video panel (`fd6cf70`)
- **GHL integration**: bidirectional contact sync + SMS messaging (`b9672f3`) — `src/lib/ghl.ts`, `src/actions/ghl.ts`, `/ghl` admin page, V067 migration adds `core.person.ghl_contact_id`

### In Progress / Next
- **Plan 16 — Deployment**: middleware fix done; remaining = Neon DB + Vercel provisioning (human actions), prod env vars, Resend domain verification.
- All schema areas covered; Plan 17 calendar shipped. Next: deployment prep or new features.

## Git State (as of 2026-06-10)

- Branch: `master`, PRs #1–#12 merged; post-PR work committed directly to master
- Untracked: `app/.env` (local secrets — never commit), `app/test-results/`, `JLYCC favicon_io/`, plan docs 12–16
- `.worktrees/` has 4 stale worktrees (feature, plan6b, plan12, plan5)
- Verified 2026-06-10: `tsc --noEmit` clean; unit tests 245/245 passing (vitest 4); prod build compiles
- E2E: 12 spec files (calendar.spec.ts added; some skipped: accumulated test data, QR code) — calendar E2E not yet run (needs local DB)

## Known Issues / Risks

- `app/.env` exists locally (untracked, now gitignored, contains secrets) — never commit; create from `app/.env.example` on new machines
- GHL Location ID hardcoded as display text in `src/app/(admin)/ghl/page.tsx` (UI only, API uses env var)
- `RESEND_API_KEY` + `RESEND_FROM` must be set in prod env for email delivery to work
- `flyway.conf` + `docker-compose.yml` have hardcoded local dev credentials — do NOT use in production
- `jly-church-db.zip` in root is untracked binary — gitignore or delete; `jly-church-db/` folder is an empty stub
- `CLAUDE.md` at repo root (parent folder) is for a different project (DMerch) — this file is the correct one

## Pending Tasks

1. **Run calendar E2E** — `npx playwright test tests/e2e/calendar.spec.ts` against a local DB
2. **Set prod env vars** — `RESEND_API_KEY`, `RESEND_FROM`, `PORTAL_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `GHL_*`, `APP_BASE_URL`
3. **Finish Plan 16 deployment** — Neon + Vercel provisioning (human actions)

## Suggested Next Steps

1. Deployment (Plan 16 remaining tasks)
2. Member giving/finance module
3. E2E flaky test investigation (accumulated test data issue)
4. Clean stale `.worktrees/` entries

## Safety Notes

- Do NOT delete `db/migrations/` — Flyway is idempotent but history matters
- Do NOT touch `app/src/schema/` without a corresponding migration in `db/migrations/`
- Do NOT commit `.env` files
- `app/.next/` is build output — safe to delete if build issues arise
- All new destructive DB changes need a new versioned migration (V067+)
