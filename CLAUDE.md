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
| Auth | NextAuth.js v5 (credentials) |
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
│   ├── migrations/             # 66 Flyway SQL migrations (V001–V066) + repeatable seeds
│   └── docker-compose.yml      # Local PostgreSQL 16 + Flyway
└── docs/superpowers/
    ├── plans/                  # Implementation plans (Plans 1–15)
    └── specs/                  # Architecture specs
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

### In Progress / Next
- All schema areas covered. Next: define new features or deployment prep.

## Git State

- Branch: `master` (in sync with origin, all PRs #1–#12 merged)
- Unit tests: 216 passing (13 test files)
- E2E: ~56 tests across 13 spec files (some skipped: accumulated test data, QR code)

## Known Issues / Risks

- No `.env` file in repo — create `app/.env` from `app/.env.example` before running locally
- `RESEND_API_KEY` + `RESEND_FROM` must be set in prod env for email delivery to work
- `flyway.conf` has hardcoded local dev credentials — do NOT use in production
- `jly-church-db.zip` in root is untracked binary — gitignore or delete
- `CLAUDE.md` at repo root (parent folder) is for a different project (DMerch) — this file is the correct one

## Pending Tasks

1. **Gitignore `jly-church-db.zip`** — binary archive, should not be tracked
2. **Set prod env vars** — `RESEND_API_KEY`, `RESEND_FROM`, `PORTAL_SECRET`, `AUTH_SECRET`

## Suggested Next Steps

1. Deployment prep (Vercel + Supabase/Neon for prod DB)
2. SMS delivery for announcements (Twilio)
3. Member giving/finance module
4. E2E flaky test investigation (accumulated test data issue)

## Safety Notes

- Do NOT delete `db/migrations/` — Flyway is idempotent but history matters
- Do NOT touch `app/src/schema/` without a corresponding migration in `db/migrations/`
- Do NOT commit `.env` files
- `app/.next/` is build output — safe to delete if build issues arise
- All new destructive DB changes need a new versioned migration (V067+)
