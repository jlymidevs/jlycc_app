# Admin Shell Unification — `/users` Under DashboardShell + Cross-Dashboard Nav

**Date:** 2026-06-12
**Branch:** `member-dashboard-redesign` (extends PR #15)
**Status:** Approved

## Problem

After the member dashboard redesign, three of four dashboards (`(admin)`, `/me`, `/ministry`) share the GHL-style sidebar + main-content `DashboardShell`. Two gaps remain:

1. `/users` (super-admin user management) renders bare — no sidebar, old gray/blue styling outside the lime design system.
2. The admin sidebar has no links to `/users`, `/me`, or `/ministry`, so admins can only reach other dashboards by typing URLs.

## Goal

Every dashboard renders inside `DashboardShell`. SUPER_ADMIN and ADMIN can reach every dashboard they are authorized for from the sidebar. **Navigation is UI only — authorization is unchanged and remains strictly enforced.**

## Non-Goals

- No change to any permission, role gate, or middleware rule.
- No change to public pages (`/church/*`, `/portal/[token]`) or onboarding (`/welcome`, `/login`, `/signup`).
- ADMIN does **not** gain access to `/users` (stays SUPER_ADMIN-only).

## Design

### 1. Move `/users` into the `(admin)` route group

`app/src/app/users/` → `app/src/app/(admin)/users/`. Route groups do not affect URLs — the page stays at `/users` and inherits the admin `DashboardShell` layout automatically. No standalone layout (rejected alternative: duplicate session/shell logic with no benefit).

### 2. Role-filtered admin nav: `adminNavForRole(role)`

In `app/src/lib/admin-nav.tsx`, replace the `adminNavItems` const export with:

```ts
export function adminNavForRole(role: Role): ShellNavItem[]
```

- Base: the existing 10 items (Members … GHL Sync), unchanged.
- `if (hasRole(role, "SUPER_ADMIN"))` → append **Users** (`/users`).
- Always append cross-links: **My Dashboard** (`/me`) and **Ministry Dashboard** (`/ministry`) — anyone who passes the admin layout gate (ADMIN+) is authorized for both via the role hierarchy.

Mirrors the existing `memberNavForRole` pattern (pure, unit-testable). `(admin)/layout.tsx` reads `session.user.role` and passes `adminNavForRole(role)` to the shell.

### 3. Restyle the users page

Rewrite `/users` page markup to the lime design system (`card` containers, CSS-variable colors) consistent with the other redesigned pages. `UserRoleControls` component behavior and the `requireRole("SUPER_ADMIN")` page gate are untouched.

## Authorization (unchanged, verified)

Three independent layers already enforce access; this design touches none of them:

| Layer | Rule |
|-------|------|
| `app/src/middleware.ts` | `/users/*` requires SUPER_ADMIN (line ~67); `/ministry/*` requires MINISTRY_HEAD+ |
| Page guard | `requireRole("SUPER_ADMIN")` in `users/page.tsx` |
| Role hierarchy | `hasRole` in `app/src/lib/authz.ts` (MEMBER < MINISTRY_HEAD < ADMIN < SUPER_ADMIN) |

Hiding a nav item is presentation only; a hand-typed URL is still rejected by middleware + page guard.

## Testing

- **Unit** (`tests/unit/admin-nav.test.tsx`): `adminNavForRole` — ADMIN gets 12 items (no Users); SUPER_ADMIN gets 13 (with Users); cross-links present for both; every item has label + icon.
- **E2E** (extend `member-dashboard.spec.ts`): seeded SUPER_ADMIN sees Users link in sidebar and `/users` renders inside the shell (sidebar present); existing roles-journey middleware tests continue to cover the deny path.
- **Gates:** full vitest, `tsc --noEmit`, prod build, E2E trio vs local DB.

## Risk

Low. No schema, no migrations, no new dependencies, no auth-surface change. Largest change is presentational markup on one page.
