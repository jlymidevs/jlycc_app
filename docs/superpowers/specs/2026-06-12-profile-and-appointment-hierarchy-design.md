# One-Time Welcome, My Profile & Appointment Hierarchy — Design

**Date:** 2026-06-12
**Status:** Approved by owner (brainstorming session)

## Problem

1. `/welcome` (post-Google-signin profile completion) re-appears on every login for
   members without a ministry membership or join request — the skip check tests the
   wrong thing. It must show exactly once.
2. Members have no way to update their own profile after the welcome step.
3. Leadership appointments have no in-app chain. Desired flow: everyone starts as a
   regular member; Admin/Super Admin designate Network Heads; a Network Head appoints
   Ministry Heads within their network; a Ministry Head promotes members of their
   chapter up the lifecycle ladder to Inner Core.
4. Members can't clearly see their own standing (Regular Member / Joshua Generation /
   Inner Core) — the `/me` ladder shows it implicitly but there is no explicit label.

## Scope

Two phases, one spec. Phase 1 is independent of Phase 2 and ships first.

- **Phase 1:** one-time welcome, `/me/profile` self-service page, stage visibility.
- **Phase 2:** `NETWORK_HEAD` role, `network_leader` table, `/network-head` dashboard,
  appoint/remove actions, Ministry Head stage promotion.

Out of scope: full street addresses (city/province + country only), password change UI,
photo upload, appointing Inner Core by anyone other than the chapter's Ministry Head.

## Data model

### V070 — profile completion, address relax, role expansion

```sql
ALTER TABLE app.users ADD COLUMN profile_completed_at timestamptz;
ALTER TABLE core.address ALTER COLUMN line1 DROP NOT NULL;
ALTER TABLE app.users DROP CONSTRAINT users_role_check;
ALTER TABLE app.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','NETWORK_HEAD','MINISTRY_HEAD','MEMBER'));
-- Backfill: existing MEMBER accounts that already completed the welcome step
-- (have a linked person) must not see /welcome again.
UPDATE app.users SET profile_completed_at = now()
  WHERE role = 'MEMBER' AND person_id IS NOT NULL;
```

### V071 — network leadership

```sql
CREATE TABLE ministries.network_leader (
  leader_id    BIGSERIAL PRIMARY KEY,
  network_id   BIGINT NOT NULL REFERENCES ministries.network(network_id),
  member_id    BIGINT NOT NULL REFERENCES membership.member(member_id),
  appointed_by BIGINT REFERENCES membership.member(member_id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one active head per network
CREATE UNIQUE INDEX one_active_head_per_network
  ON ministries.network_leader(network_id) WHERE ended_at IS NULL;
```

Drizzle: add `profileCompletedAt` to `app.ts` users, `networkLeader` to `ministries.ts`.
`authz.ts` ROLES becomes `["MEMBER","MINISTRY_HEAD","NETWORK_HEAD","ADMIN","SUPER_ADMIN"]`
(ordered ladder; `hasRole` unchanged).

## Phase 1 — one-time welcome + My Profile

### Welcome gating

- `/welcome` first checks `users.profile_completed_at`; when set → `redirect("/me")`.
  The existing membership/join-request skip stays as a secondary guard (covers legacy
  rows the backfill might miss).
- `completeProfile` sets `profile_completed_at = now()` in the same transaction as the
  person update.
- Google sign-in keeps `redirectTo: "/welcome"`; the page self-skips. No middleware
  change needed for this.

### `/me/profile` page ("My Profile" in member sidebar)

- Added to `memberNavForRole` for all roles.
- Editable: first name, last name, mobile, birthday, gender, country (dropdown,
  default `PH`), province/city (when country = PH: dropdown of the 82 PH provinces +
  NCR from a static `src/lib/ph-provinces.ts`; otherwise a free-text input).
- Read-only: email (login identity), membership stage (label, e.g. "Inner Core").
- Save → new `updateMyProfile` server action:
  - person update + mobile upsert — extracted into a shared helper used by both
    `completeProfile` and `updateMyProfile` (no logic duplication);
  - address upsert: current HOME address row (`person_address.valid_to IS NULL`) —
    update its `city`/`province`/`country_code` if present, else insert
    `core.address` (line1 NULL) + `person_address` (type HOME, valid_from today).

### Stage visibility

- `/me` header: stage chip next to the greeting showing the lifecycle stage name
  (Regular Member / Joshua Generation / Inner Core / …). Ladder stays.
- `/me/profile`: read-only "Membership stage" row.

## Phase 2 — appointment hierarchy

Strict chain, each level can do exactly one thing:

| Actor | Power | Surface |
|---|---|---|
| ADMIN / SUPER_ADMIN | Appoint/remove Network Head | `/users` — per-user "Network Head" control with network picker |
| NETWORK_HEAD | Appoint/remove Ministry Head within own network | `/network-head` dashboard |
| MINISTRY_HEAD | Promote own chapter's members one stage up to INNER_CORE | `/ministry` roster "Promote" button |

### Role auto-sync

- Appoint network head → `users.role = 'NETWORK_HEAD'`; end appointment → role falls
  back to `MINISTRY_HEAD` if the member still heads any active chapter, else `MEMBER`.
- Appoint ministry head (HEAD leader-role on a chapter) → `users.role =
  'MINISTRY_HEAD'`; removal → `MEMBER` when no other active headship remains.
- Never touch the role of ADMIN / SUPER_ADMIN accounts.
- Eligibility to be appointed Ministry Head: member's `current_stage` is
  `INNER_CORE` or `JOSHUA_GENERATION` (existing head-eligibility rule).

### Stage promotion (Ministry Head)

- One step per action: `REGULAR_MEMBER → JOSHUA_GENERATION → INNER_CORE`.
- Only for members with an active membership in a chapter the actor heads.
- Writes `membership.lifecycle_stage_history` (changed-by = acting member) and
  updates `member.current_stage`.

### `/network-head` dashboard

- Network banner (name, description).
- Ministries table: each ministry, its chapters, member counts, current head.
- Appoint control per chapter: dropdown of eligible members (Inner Core / Joshua Gen,
  active in that chapter or network), Appoint button; Remove next to current head.
- Read-only full network roster with search (ListSearch component).

### Permissions enforcement

- Middleware: `/network-head` requires role ≥ NETWORK_HEAD (token check, edge-safe).
- Every server action re-validates: session role via `requireRole`, then ownership —
  network head actions verify an active `network_leader` row for the actor and that
  the target chapter belongs to that network; promotion verifies actor heads the
  member's chapter. UI filtering alone is never trusted.
- Sidebars stay role-filtered (`memberNavForRole` / `adminNavForRole` patterns);
  NETWORK_HEAD gets a "Network Dashboard" link.

## Error handling

- Appointing over an occupied network seat → friendly error (end the current head
  first); unique index is the backstop.
- Promotion of an already-INNER_CORE member → no-op with message.
- Address save failures must not lose the person-field update (person update commits
  first or both wrapped in one transaction).

## Testing

- **Unit (vitest):** ROLES ladder with NETWORK_HEAD; promotion step helper (next
  stage, top-of-ladder no-op); eligibility predicate; PH province list non-empty and
  unique; profile-completed gating predicate.
- **E2E (playwright, local DB only):** welcome shown once — complete it, sign out,
  sign in again, land on `/me`; My Profile edit round-trip incl. province dropdown;
  admin assigns network head → role flips, `/network-head` reachable; network head
  appoints ministry head → target's role flips; ministry head promotes a member →
  stage chip on `/me` updates.
- tsc + prod build clean.

## Build order

1. Phase 1 (V070, welcome gate, shared profile helper, `/me/profile`, stage chip)
2. Phase 2 (V071, authz ladder, admin assign UI, `/network-head`, promotion)

Each phase: migration → schema → actions → pages → tests.
