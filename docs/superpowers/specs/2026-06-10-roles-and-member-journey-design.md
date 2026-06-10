# Roles, Member Login & Christian Journey — Design Spec

**Date:** 2026-06-10
**Status:** Approved
**Goal:** Four-role access system (Super Admin / Admin / Ministry Head / Member), member self-signup, extended journey ladder (… → Regular Member → Joshua Generation → Inner Core), ministry-head monitoring of their chapter members, and a member journey dashboard. Purpose of the app: guide each member's Christian journey, surface the church calendar, and let ministry heads monitor their members.

## Decisions (from brainstorming)

1. **Member login = self-signup.** Anyone can register (email+password form, and Google sign-in auto-creates). New accounts get role `MEMBER`. Token portal (`/portal/[token]`) stays for now; can retire later.
1a. **Ministry joining = FB-style requests with priority ranks.** A member can join MULTIPLE ministries, each membership/request carrying a priority rank (1 = main ministry, then 2, 3 …). Example: 1st priority Dance Ministry (dances), 2nd Children's Ministry (teaches), 3rd Youth Ministry (member). At signup the new member picks a ministry head from a list — that becomes their priority-1 request. More requests can be added later from `/me`. Every request is PENDING until that ministry's head approves or rejects; the head sees the member's priority rank for their ministry when deciding. Approval joins the member to the head's chapter. Priority ranks are unique per member across their active memberships + pending requests.
1b. **Every user has a member profile.** Role = account capability; profile = church identity. Admins/super-admins also have their own member profile (their own stage — Regular Member / Joshua Generation / Inner Core — and may themselves be ministry heads). `/me` is available to all roles.
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
3. `V069__ministries_join_request.sql` — `ministries.join_request`:
   - `request_id bigserial PK`, `member_id` → membership.member, `chapter_id` → ministries.ministry_chapter (the head's chapter), `priority smallint NOT NULL` (1 = main ministry), `status` enum PENDING/APPROVED/REJECTED (default PENDING), `requested_at`, `decided_at`, `decided_by_member_id` (the head).
   - Partial unique index: one PENDING request per (member, chapter). Unique (member, priority) among PENDING requests enforced in app layer (must also account for approved memberships).
   - `ALTER TABLE ministries.ministry_membership ADD COLUMN priority smallint` — carries the rank onto the membership when approved.
4. Drizzle `app.ts`: add `personId`, `isActive`; keep `role` as text (DB CHECK enforces values). Drizzle `ministries.ts`: add `headRequest` table + status enum.

## Auth & signup flow

- `/signup` (public): name, email, password + **pick a ministry head** (required; list of active heads with ministry/chapter name) → Zod-validated → creates `app.users` row (role `MEMBER`, bcrypt hash). Linking: if `core.person` with same email exists, link it; otherwise create person. If no `membership.member` record exists for that person, **auto-create one at stage `REGULAR_MEMBER`** (every user has a member profile). Then create a `join_request` (PENDING, priority 1) to the chosen head's chapter.
- Google sign-in: currently rejects unknown emails. Change: unknown email → auto-create user with role `MEMBER` (same linking rule). Known email → normal sign-in.
- Session JWT carries `role` + `personId`. NextAuth callbacks updated.
- Post-login redirect by role: ADMIN+ → `/members` (unchanged), MINISTRY_HEAD → `/ministry`, MEMBER → `/me`.

## Route protection

- Middleware additions: `/me` requires session; `/ministry` requires MINISTRY_HEAD+; `/users` requires SUPER_ADMIN; existing `(admin)` route list requires ADMIN+. MEMBER hitting admin routes → redirect `/me`.
- Server actions double-check role server-side (`requireRole(...)` helper in `lib/authz.ts`) — middleware alone is not sufficient.

## New pages

1. **`/signup`** — public signup form.
2. **`/me`** — member profile dashboard, available to ALL roles (admins too):
   - Journey ladder visual (all non-terminal stages in order, current highlighted, next stage + its description).
   - **My ministries section**: active memberships ordered by priority (1st, 2nd, 3rd …) with ministry name + head name.
   - **Join a ministry section**: list of joinable ministries/chapters (with head names); "Request to join" picks the next free priority rank (member can adjust rank before submitting). Pending/rejected requests listed with status (Pending with head's name / Rejected with re-request option).
   - Nav shows "My profile" for every logged-in user; ADMIN+ nav shows both admin modules and My profile.
3. **`/ministry`** — head dashboard: **Requests section first** — pending join_requests for the head's chapter(s), each showing member name, current stage, and **the member's priority rank for this ministry** (e.g. "1st priority" vs "3rd priority"), with Approve / Reject buttons (badge count in nav). Approve → create `ministry_membership` row (joined_at now, priority copied from request) + mark request APPROVED. Reject → mark REJECTED (member can re-request or request another ministry from `/me`). Below: per chapter roster table (member, priority, current stage, last attendance date from `attendance` schema), add member directly (search), remove (end membership with `ended_at`).
4. **`/users`** — super-admin user management: table (email, name, role, linked person), change-role action, deactivate/reactivate. Deactivation = `is_active boolean NOT NULL DEFAULT true` column (added in V068); sign-in callbacks reject inactive users.
5. **Admin chapter page change** — existing chapter detail gets "Assign head" (choose member in roster → set leader). **Eligibility rule: only members whose current stage is `INNER_CORE` or `JOSHUA_GENERATION` can be appointed ministry head** — the picker filters to eligible members and the server action rejects ineligible ones. If that member's email matches a user account, promote account to `MINISTRY_HEAD` (and demote to `MEMBER` when unset and they lead no other chapter).

## Error handling

- Signup: duplicate email → field error. Weak password (<8 chars) → field error.
- Signup when zero active ministry heads exist: head picker hidden, signup proceeds without a request; `/me` lets them request later.
- Approving a request for a member already in that chapter: idempotent — mark APPROVED, skip duplicate membership row.
- Priority conflicts (requested rank already taken by an active membership or pending request): server rejects with field error; UI offers next free rank.
- Member leaves a ministry / request rejected: their other priorities keep their numbers (no auto-renumber); freed rank becomes available for the next request.
- Role guard failures: redirect, never 500.
- Head with zero chapters: `/ministry` shows empty state.
- Legacy users (pre-V068) without `person_id`: `/me` shows "profile not linked" notice; super admin can link person on `/users`.

## Testing

- Unit: signup Zod schema (incl. head selection); join-request schema (priority validation); `requireRole` hierarchy helper; stage-ladder ordering helper; next-free-priority helper; head-eligibility helper (stage ∈ {INNER_CORE, JOSHUA_GENERATION}) (all pure).
- E2E: signup with head pick → `/me` shows priority-1 request "Pending approval from <head>"; head logs in → sees request with priority rank → approves → member's `/me` shows ministry under My ministries; member requests a 2nd ministry (priority 2); reject path → member re-requests; MEMBER blocked from `/members`; super admin changes role on `/users`; admin assigns head on chapter; admin sees own `/me` profile.

## Out of scope

- Password reset / email verification.
- Retiring token portal.
- Per-member journey requirements/checklists for advancing stages (future).
- Notifications to heads.
