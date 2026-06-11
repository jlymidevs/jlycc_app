# Member Dashboard Redesign — Design Spec

**Date:** 2026-06-11
**Status:** Approved (brainstorm complete)
**Branch (planned):** `member-dashboard-redesign`

## Goal

Make the member-facing dashboard (`/me`, `/ministry`) use the same professional
sidebar layout as the admin portal, split the monolithic `/me` page into focused
pages, and add interactive animations with Framer Motion. All dashboards share
one shell so they can never drift apart visually again.

## Decisions (from brainstorm)

| Question | Decision |
|----------|----------|
| Sidebar contents | Member-specific nav set (not admin items) |
| Page structure | Split `/me` into separate pages per nav item |
| Animation approach | Framer Motion (new dependency) |
| Mobile | Responsive: fixed sidebar on desktop, hamburger → slide-in drawer on mobile |
| Announcements | Yes — read-only member feed at `/me/announcements` |
| Architecture | Approach A: shared `DashboardShell` component used by admin AND member layouts |

## Architecture

### 1. Shared shell: `app/src/components/dashboard-shell.tsx`

Extract the chrome currently in `app/src/app/(admin)/layout.tsx` (sidebar,
brand, nav, user card, topbar, theme toggle, logout) into a reusable
`DashboardShell` component:

```ts
type ShellNavItem = { href: string; label: string; icon: React.ReactNode };
type DashboardShellProps = {
  navItems: ShellNavItem[];
  portalLabel: string;          // "Admin Portal" | "Member Portal"
  brandHref: string;            // "/members" | "/me"
  user: { name: string | null; email: string | null };
  children: React.ReactNode;
};
```

- Server component wrapper + client component for interactive parts
  (nav active state, mobile drawer, motion).
- **Admin layout** becomes a thin wrapper: auth check → `DashboardShell` with
  the existing admin nav items (moved out of `sidebar-nav.tsx`).
- **Member layouts** (`me/layout.tsx`, `ministry/layout.tsx`) use
  `DashboardShell` with the member nav set.
- `member-shell.tsx` and `sidebar-nav.tsx` are absorbed/deleted once both
  consumers migrate.

### 2. Member nav set

| Item | Href | Visible to |
|------|------|-----------|
| Overview | `/me` | all members |
| My Attendance | `/me/attendance` | all members |
| My Ministries | `/me/ministries` | all members |
| Announcements | `/me/announcements` | all members |
| Calendar | `/church/calendar` | all members |
| Ministry Dashboard | `/ministry` | `MINISTRY_HEAD`+ |
| Admin Portal | `/members` | `ADMIN`+ |

Role filtering is a pure function (`memberNavForRole(role)`) in
`app/src/lib/member-nav.tsx` so it is unit-testable. Uses existing
`hasRole` from `@/lib/authz`.

### 3. Pages

All pages remain **server components** that fetch data and pass it to small
client animation widgets.

- **`/me` (overview, rewritten):** greeting header ("Good morning, {firstName}"
  by Asia/Manila hour), animated journey ladder (motion fill + current-stage
  pulse), 3 stat cards with count-up numbers (total / this-year / last
  attended), next upcoming public event card, quick-action links
  (attendance, ministries, calendar).
- **`/me/attendance` (new):** stat cards (count-up), recent check-ins list with
  staggered reveal. Reuse `attendance-trends.ts` helpers + adapt
  `trend-chart.tsx` for a personal weekly trend if check-in data supports it;
  otherwise list-only (decide at implementation, not a blocker).
- **`/me/ministries` (new):** current memberships (priority badges),
  join-request list with animated status badges, join form (moved from current
  `/me`). Server actions unchanged (`requestJoin`).
- **`/me/announcements` (new):** published announcements where this member is a
  recipient (Plan 13 `communications` schema — announcements + fan-out
  recipients). Read-only cards, staggered entrance. Query helper in
  `app/src/actions/` or a lib function, unit-tested.
- **`/ministry`:** content unchanged, just wrapped in the new shell.

### 4. Animations (Framer Motion)

New dependency: `framer-motion` (latest stable, exact version pinned).

Client widgets in `app/src/components/`:

- `motion-card.tsx` — entrance fade-up + spring hover lift; stagger via
  parent variants.
- `animated-number.tsx` — count-up on mount (spring/`animate`).
- `journey-ladder.tsx` — animated progress fill across stages, current stage
  highlighted with subtle pulse.
- Drawer in shell — slide-in + backdrop fade (`AnimatePresence`).
- Active nav pill — `layoutId` shared layout animation between items.

Rules:

- `"use client"` only on leaf widgets; data fetching stays on the server.
- Respect `prefers-reduced-motion` (`useReducedMotion`) — fall back to
  no-motion render.
- Keep existing CSS design system (lime palette, `card`, CSS variables);
  Framer Motion adds motion, does not replace styling.

### 5. Mobile

- `< md`: sidebar hidden; hamburger button in topbar opens slide-in drawer
  (same nav, motion-animated), backdrop closes it; drawer closes on route
  change.
- `>= md`: fixed sidebar, identical to admin portal today.
- Admin portal gains the same responsive behavior for free (shared shell) —
  improvement, not regression; verify admin pages still render correctly.

### 6. Error handling

- `/me` unlinked-profile case (no `member` row) keeps its current friendly
  message, now inside the shell.
- `/me/announcements` with zero announcements → empty state card.
- All new pages guard with `requireRole("MEMBER")` like current `/me`.

### 7. Testing

- **Unit (Vitest):** `memberNavForRole` role filtering; announcements
  recipient query helper (pure SQL-builder or extracted filter logic);
  greeting-by-hour helper.
- **E2E (Playwright, local DB only):** member login → sidebar visible with
  member items, no Admin Portal link; navigate to each member page; admin
  login → Admin Portal nav unchanged.
- **Gates:** `tsc --noEmit` clean, all unit tests pass, prod build clean.
  Never run E2E against Neon URL (per CLAUDE.md).

## Out of scope

- No DB migrations (read-only over existing schemas).
- No changes to admin page content — only the shared shell refactor.
- No public-page (`/church/*`) changes.
- No announcements read/unread tracking (badge shows count of recent
  published announcements at most; no new tables).
