# Roles, Member Login & Christian Journey — Design Spec

**Date:** 2026-06-10
**Status:** Approved
**Goal:** Four-role access system (Super Admin / Admin / Ministry Head / Member), member self-signup, extended journey ladder (… → Regular Member → Joshua Generation → Inner Core), ministry-head monitoring of their chapter members, and a member journey dashboard. Purpose of the app: guide each member's Christian journey, surface the church calendar, and let ministry heads monitor their members.

## Decisions (from brainstorming)

1. **Member login = self-signup.** Anyone can register (email+password form, and Google sign-in auto-creates). New accounts get role `MEMBER`. Token portal (`/portal/[token]`) stays for now; can retire later.
2. **Stages extend the existing ladder upward.** `JOSHUA_GENERATION` (order 50) and `INNER_CORE` (order 60) added above `REGULAR_MEMBER` (40). Full ladder: FTV → OGV → RA → REGULAR_MEMBER → JOSHUA_GENERATION → INNER_CORE (DFL stays terminal).
3. **Head assignment reuses ministry chapters.** Head→chapter link = existing `ministries.ministry_membership` row with `is_leader = true, leader_role = 'HEAD'`. No new table.
4. **ADMIN = everything except user-role management.** Only SUPER_ADMIN manages user accounts/roles.
5. **Member dashboard = journey progress** (current stage, next stage, what it means). Calendar already public at `/church/calendar`.

## Roles

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | All ADMIN functions + `/users` page: list users, change roles, deactivate. Cannot demote self. |
| `ADMIN` | All existing admin modules (members, events, attendance, programs, education, ministries, missions, announcements, GHL) + designate ministry heads (set `is_leader`/`leader_role` on chapter membership, which also promotes that user to `MINISTRY_HEAD` if they have an account). |
| `MINISTRY_HEAD` | `/ministry` area: own chapter(s) roster — add/remove chapter members, monitoring table (member name, current stage, last attendance date). Plus everything MEMBER gets. No access to `(admin)` routes. |
| `MEMBER` | `/me` journey dashboard + public pages. Default for all new signups. |

Hierarchy is strict: SUPER_ADMIN > ADMIN > MINISTRY_HEAD > MEMBER. Guards check "role at least X".

## Data changes (migration V068 + seed update)

1. `R__seed_lifecycle_stages.sql`: add `JOSHUA_GENERATION` ('Joshua Generation', order 50) and `INNER_CORE` ('Inner Core', order 60), both non-terminal. (Repeatable seed re-runs idempotently.)
2. `V068__app_users_roles.sql`:
   - `ALTER TABLE app.users ADD COLUMN person_id bigint REFERENCES core.person(person_id)` (nullable, unique).
   - `ALTER TABLE app.users ADD COLUMN is_active boolean NOT NULL DEFAULT true`.
   - `UPDATE app.users SET role = 'ADMIN' WHERE role = 'staff'`.
   - `UPDATE app.users SET role = 'SUPER_ADMIN' WHERE email = 'admin@jly.church'`.
   - CHECK constraint: role IN ('SUPER_ADMIN','ADMIN','MINISTRY_HEAD','MEMBER').
3. Drizzle `app.ts`: add `personId`, keep `role` as text (DB CHECK enforces values).

## Auth & signup flow

- `/signup` (public): name, email, password → Zod-validated → creates `app.users` row, role `MEMBER`, bcrypt hash. Email-match linking: if `core.person` with same email exists (via contact info / person email), set `person_id`; otherwise create a bare `core.person` and link. **No member record is auto-created** — journey dashboard shows "Your membership record is pending — talk to your leader" until staff creates the member record (existing flow).
- Google sign-in: currently rejects unknown emails. Change: unknown email → auto-create user with role `MEMBER` (same linking rule). Known email → normal sign-in.
- Session JWT carries `role` + `personId`. NextAuth callbacks updated.
- Post-login redirect by role: ADMIN+ → `/members` (unchanged), MINISTRY_HEAD → `/ministry`, MEMBER → `/me`.

## Route protection

- Middleware additions: `/me` requires session; `/ministry` requires MINISTRY_HEAD+; `/users` requires SUPER_ADMIN; existing `(admin)` route list requires ADMIN+. MEMBER hitting admin routes → redirect `/me`.
- Server actions double-check role server-side (`requireRole(...)` helper in `lib/authz.ts`) — middleware alone is not sufficient.

## New pages

1. **`/signup`** — public signup form.
2. **`/me`** — member journey dashboard: ladder visual (all non-terminal stages in order, current highlighted, next stage + its description), member info if linked; pending notice if no member record.
3. **`/ministry`** — head dashboard: list of chapters where head's member row has `is_leader=true`; per chapter: roster table (member, current stage, last attendance date from `attendance` schema), add member (search existing members), remove (end membership with `ended_at`).
4. **`/users`** — super-admin user management: table (email, name, role, linked person), change-role action, deactivate/reactivate. Deactivation = `is_active boolean NOT NULL DEFAULT true` column (added in V068); sign-in callbacks reject inactive users.
5. **Admin chapter page change** — existing chapter detail gets "Assign head" (choose member in roster → set leader). If that member's email matches a user account, promote account to `MINISTRY_HEAD` (and demote to `MEMBER` when unset and they lead no other chapter).

## Error handling

- Signup: duplicate email → field error. Weak password (<8 chars) → field error.
- Role guard failures: redirect, never 500.
- Head with zero chapters: `/ministry` shows empty state.
- Member with no `person_id`/member record: `/me` shows pending state, no crash.

## Testing

- Unit: signup Zod schema; `requireRole` hierarchy helper; stage-ladder ordering helper (pure).
- E2E: signup → redirected to `/me` with pending state; MEMBER blocked from `/members`; super admin changes role on `/users`; admin assigns head on chapter; head adds member to roster and sees stage column.

## Out of scope

- Password reset / email verification.
- Retiring token portal.
- Per-member journey requirements/checklists for advancing stages (future).
- Notifications to heads.
