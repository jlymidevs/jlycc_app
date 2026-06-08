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

### In Progress / Next
- **Plan 9** — not yet defined; next feature TBD

## Git State

- Branch: `master` (in sync with origin)
- Untracked: `CLAUDE.md`, `docs/superpowers/plans/2026-04-19-foundation-implementation.md`, `docs/superpowers/plans/2026-06-08-plan6c-public-homepage.md`, `docs/superpowers/plans/2026-06-09-plan8-education.md`, `docs/superpowers/specs/2026-04-19-jly-church-database-design.md`, `jly-church-db.zip`
- Remote branches: plan5/6a/6b/6c/7/8 feature branches all merged

## Known Issues / Risks

- No `.env` file in repo — must create `app/.env` from `app/.env.example` before running locally
- `flyway.conf` has hardcoded local dev credentials — do NOT use in production
- `jly-church-db.zip` in root is untracked binary — gitignore or delete
- `CLAUDE.md` at repo root (parent folder) is for a different project (DMerch) — this file is the correct one

## Pending Tasks

1. **Commit untracked docs** — foundation plan, plan 6c plan, plan 8 plan, DB spec
2. **Gitignore `jly-church-db.zip`** — binary archive, should not be tracked
3. **Run E2E tests** against live DB to validate Plan 7 + Plan 8 UI flows
4. **Define Plan 9** — next feature area TBD

## Suggested Next Steps

1. Run `cd app && npm run dev` + `npx playwright test` to validate Plan 7 + 8 E2E against real DB
2. Define Plan 9 — next logical area based on remaining schema (missions, finance, or membership extensions)

## Safety Notes

- Do NOT delete `db/migrations/` — Flyway is idempotent but history matters
- Do NOT touch `app/src/schema/` without a corresponding migration in `db/migrations/`
- Do NOT commit `.env` files
- `app/.next/` is build output — safe to delete if build issues arise
- All destructive DB changes need a new versioned migration (V066+)
