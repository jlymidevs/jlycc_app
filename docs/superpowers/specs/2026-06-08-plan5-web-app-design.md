# JLY Church App — Plan 5: Web App Foundation & Member Management Design

## Goal

Add a Next.js 14 web app to the monorepo. Ship staff-facing member management (search, view, create, edit) as the first module. Lay the foundation for future modules (events, attendance, public portal).

## Scope

**In scope (Plan 5):**
- `app/` scaffold: Next.js 14 App Router, TypeScript, Tailwind, Drizzle ORM, Auth.js
- Staff authentication (email/password + Google OAuth)
- Member management: list, search, view, create, edit
- Route protection middleware

**Out of scope (future plans):**
- Event registration and attendance tracking (Plan 6)
- Public-facing pages (Plan 6)
- Staging/ETL web UI (separate plan)
- Finance and reporting (future)

---

## Architecture

### Repo Structure

```
JLYCC App/
├── db/          # existing — Flyway migrations, pgTAP tests, staging scripts
├── etl/         # existing — Python loader stub
├── docs/        # existing — specs, plans, ERD
└── app/         # NEW — Next.js 14 web app
    ├── src/
    │   ├── app/             # App Router pages and layouts
    │   │   ├── (admin)/     # Route group — staff-only, auth-protected
    │   │   │   ├── layout.tsx
    │   │   │   ├── members/
    │   │   │   │   ├── page.tsx         # member list + search
    │   │   │   │   ├── new/page.tsx     # create member
    │   │   │   │   └── [id]/
    │   │   │   │       ├── page.tsx     # member detail
    │   │   │   │       └── edit/page.tsx
    │   │   ├── login/page.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx     # public home (placeholder)
    │   ├── components/
    │   │   ├── ui/          # shared primitives (button, input, table, badge)
    │   │   └── members/     # member-specific components
    │   ├── lib/
    │   │   ├── db.ts        # Drizzle client (singleton)
    │   │   ├── auth.ts      # Auth.js config
    │   │   └── validations/ # Zod schemas
    │   ├── schema/          # Drizzle table definitions (mirrors Flyway)
    │   │   ├── core.ts
    │   │   └── membership.ts
    │   └── actions/         # Server Actions
    │       └── members.ts
    ├── middleware.ts         # route protection
    ├── package.json
    ├── tailwind.config.ts
    ├── drizzle.config.ts
    └── .env.local           # gitignored
```

### Key Dependencies

| Package | Purpose |
|---|---|
| `next` 14 | App Router, Server Components, Server Actions |
| `typescript` | Type safety |
| `tailwindcss` | Styling |
| `drizzle-orm` | Type-safe Postgres queries |
| `drizzle-kit` | Schema introspection + migrations |
| `next-auth` v5 | Staff authentication |
| `postgres` | Node Postgres driver |
| `zod` | Input validation |
| `vitest` | Unit tests |
| `@playwright/test` | E2E tests |

### DB Connection

- Dev: `DATABASE_URL` → local Docker Compose Postgres (same as `db/docker-compose.yml`)
- Prod: `DATABASE_URL` → production Postgres
- Drizzle uses `app_reader` role for queries, `app_writer` role for mutations — both already granted in Flyway migrations (V025, V042, V049, V059, V063)

---

## Auth & Roles

### User Classes

| Class | Access | Auth |
|---|---|---|
| Staff | Full admin — read/write members, lifecycle, roles | Email/password or Google OAuth |
| Public | Event browse + register (Phase 2 only) | No login |

### Staff Accounts

New `app.users` table (app-managed, outside Flyway church schemas):

```sql
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE app.users (
  user_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email     TEXT NOT NULL UNIQUE,
  name      TEXT,
  password_hash TEXT,          -- null if Google OAuth only
  role      TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Auth.js (NextAuth v5) handles session tokens via HTTP-only cookies.

### Route Protection

`middleware.ts` checks session on all `/admin/*` routes. Unauthenticated requests redirect to `/login`. Raw 403s never surface to the browser.

---

## Member Management Module

### Routes

| Route | Purpose |
|---|---|
| `GET /admin/members` | Paginated list, search by name/branch/stage |
| `GET /admin/members/new` | Create member form |
| `POST /admin/members/new` | Server Action — create person + member |
| `GET /admin/members/[id]` | Full member profile |
| `GET /admin/members/[id]/edit` | Edit form |
| `POST /admin/members/[id]/edit` | Server Action — update record |

### Member Profile View

Displays (read from joined query):
- Personal info: `core.person` (name, birth date, sex, civil status)
- Contact info: `core.contact_info` (phone, email)
- Address: `core.person_address` → `core.address`
- Household: `core.household_member` → `core.household`
- Current lifecycle stage: `membership.member.current_stage_code`
- Branch: `membership.member` → `core.branch`
- Roles: `membership.member_role` → `membership.role`
- Pastoral care: `membership.pastoral_care_assignment`

### Create Flow

1. Staff fills form: first name, last name, birth date, sex, email, phone, branch, lifecycle stage
2. Server Action validates with Zod
3. Drizzle inserts: `core.person` → `core.contact_info` → `membership.member`
4. Lifecycle stage history trigger fires automatically (existing DB trigger)
5. Redirect to new member's detail page

### Edit Flow

- Edit basic fields: name, contact info, lifecycle stage transition
- Stage transition via update to `membership.member.current_stage_code` — existing trigger auto-writes `lifecycle_stage_history`
- Branch transfer updates `membership.member.branch_id` — existing trigger auto-writes `branch_membership_history`

---

## Data Flow

### Read (Server Components)

```
RSC page → Drizzle query (app_reader role) → typed result → render
```

- All admin pages server-rendered — no client-side data fetching
- Suspense boundaries on slow joined queries
- Drizzle schema types flow end-to-end (no manual casting)

### Mutation (Server Actions)

```
HTML form → Server Action → Zod validation → Drizzle mutation (app_writer role) → revalidatePath → redirect
```

- Zod validates all input at the server action boundary
- No raw user input reaches the DB
- Progressive enhancement: forms work without JS

### Error Handling

| Error type | Handling |
|---|---|
| Validation error | Returned to form, displayed inline next to field |
| DB constraint violation | Caught, mapped to user-friendly message |
| Unexpected DB error | Logged server-side, generic "Something went wrong" shown — no schema details leaked |
| Auth failure | Middleware redirect to `/login` — never raw 403 |

---

## Testing

### Unit (Vitest)

- Zod validation schemas: valid inputs pass, invalid inputs return correct error shapes
- Pure utility functions in `lib/`
- Fast, no DB or browser required

### DB Integration (existing pgTAP)

- No duplication — existing 250+ pgTAP tests cover the DB layer
- E2E tests (below) catch app↔DB integration regressions

### E2E (Playwright)

Happy paths against local Docker Compose Postgres:
- Staff can log in and reach `/admin/members`
- Staff can search members by name
- Staff can view a member profile
- Staff can create a new member
- Staff can edit a member's lifecycle stage

---

## Plan 5 Deliverables

1. `app/` scaffold committed to repo
2. Auth.js staff login working (email/password)
3. `/admin/members` — list + search
4. `/admin/members/new` — create
5. `/admin/members/[id]` — view
6. `/admin/members/[id]/edit` — edit
7. Vitest unit tests for Zod schemas
8. Playwright E2E smoke test
