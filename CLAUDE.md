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
│   │   │   ├── (admin)/        # Protected admin routes (members, events, attendance)
│   │   │   ├── church/         # Public routes (no auth)
│   │   │   │   ├── events/     # Public events list + detail
│   │   │   │   ├── layout.tsx  # Shared public nav (Plan 6c)
│   │   │   │   └── page.tsx    # Church homepage, hero + 5 upcoming events
│   │   │   ├── login/          # Staff login
│   │   │   └── api/auth/       # NextAuth API route
│   │   ├── components/         # QrScanner, member-form, member-search
│   │   ├── lib/                # auth.ts, db.ts, validations/
│   │   └── schema/             # Drizzle schemas (core, membership, events, attendance, app)
│   ├── tests/
│   │   ├── e2e/                # Playwright E2E (members, events, attendance)
│   │   └── unit/               # Vitest unit tests (validations)
│   ├── .env.example            # Required env vars template
│   └── drizzle.config.ts
├── db/
│   ├── migrations/             # 65 Flyway SQL migrations (V001–V065) + repeatable seeds
│   └── docker-compose.yml      # Local PostgreSQL 16 + Flyway
└── docs/superpowers/
    ├── plans/                  # Implementation plans
    └── specs/                  # Architecture specs
```

## Current Progress

### Completed
- **Plan 1 — Foundation**: DB schema (65 migrations, 10 schemas)
- **Plan 5 — Web App**: Next.js app scaffold, NextAuth, Drizzle, member CRUD
- **Plan 6a — Events**: Event CRUD, registration, organizer assignment
- **Plan 6b — Attendance**: QR scanner, check-in, FTV capture, attendance dashboard (merged PR #3)
- **Plan 6c — Public Homepage**: `church/layout.tsx` + `church/page.tsx` + `homepage.spec.ts` (merged PR #4)
- **Plan 7 — Programs / BAC**: Heartlink + BAC admin modules, 26 files, 88 unit tests (merged PR #5)
- **Plan 8 — Education (BC + ISU)**: Bible College + ISU admin modules, 21 files, 123 unit tests (merged PR #6)
- **Plan 11 — Membership Extensions**: `regular_member_application` schema, 6 server actions, applications queue page, extended member detail page (Roles/PCM/Application sections), 31 unit tests, 6 E2E tests (merged PR #9)
- **Form action fixes**: Fixed arrow-wrapper pattern (`action={(fd)=>void fn(fd)}`) across 23+ pages — Next.js requires direct ref or `.bind()`

### In Progress / Next
- **Plan 12** — next feature TBD (missions, finance, or further membership features)

## Git State

- Branch: `master` (in sync with origin, all plan branches merged)
- E2E: 50/56 passing, 6 skipped (accumulated test data, QR code)
- Unit tests: 183 passing
- Untracked: `CLAUDE.md`, various docs in `docs/superpowers/`, `jly-church-db.zip`

## Known Issues / Risks

- No `.env` file in repo — must create `app/.env` from `app/.env.example` before running locally
- `flyway.conf` has hardcoded local dev credentials — do NOT use in production
- `jly-church-db.zip` in root is untracked binary — gitignore or delete
- `CLAUDE.md` at repo root (parent folder) is for a different project (DMerch) — this file is the correct one

## Pending Tasks

1. **Gitignore `jly-church-db.zip`** — binary archive, should not be tracked
2. **Commit untracked docs** — foundation plan, plan 6c plan, plan 8 plan, DB spec
3. **Define Plan 12** — next feature area (missions finance, events calendar, or member portal)

## Suggested Next Steps

1. Define Plan 12 based on remaining schema areas
2. E2E "see registrant" test is skipped — root cause: cross-context timing; `revalidatePath` added but test still flaky

## Safety Notes

- Do NOT delete `db/migrations/` — Flyway is idempotent but history matters
- Do NOT touch `app/src/schema/` without a corresponding migration in `db/migrations/`
- Do NOT commit `.env` files
- `app/.next/` is build output — safe to delete if build issues arise
- All destructive DB changes need a new versioned migration (V066+)
