# JLYCC App — System Redesign Blueprint

**Date:** 2026-06-12
**Status:** Design — redesign of the EXISTING app (Next.js 14 + Drizzle + PostgreSQL + NextAuth v5). Not a new app.
**Baseline:** master `c844086` — GHL-style `DashboardShell` (sidebar + main content + mobile drawer, role-filtered nav) already merged and live for all authenticated users.

---

## 1. System Overview

### Purpose

JLYCC App monitors every member's Christian journey end-to-end: first visit → attendance → discipleship → ministry involvement → leadership. It gives leaders the tools to follow up, care for, and grow members, and gives members visibility into their own progress.

### How each role interacts

| Role | Primary interaction |
|---|---|
| **Super Admin** | Owns the system: users, roles, networks, ministries, settings, all reports. Rarely does day-to-day data entry. |
| **Admin** | Operates the system daily: member records, attendance, events, announcements, reports. |
| **Network Head** | Oversees a network (group of ministries). Monitors ministry heads, aggregate attendance, journey progress, follow-up health across the network. |
| **Ministry Head** | Leads one ministry chapter. Manages its members, attendance, follow-ups, care notes, tasks; submits ministry reports. |
| **Member — Inner Circle** | Helper-leader (like class president). Sees a small assigned flock; records follow-ups and basic care notes; nudges journey progress. |
| **Member — Joshua Generation** | Regular member being discipled. Sees own journey, attendance, ministries, announcements; submits prayer requests; requests to join ministries. |

### Mapping to the existing system (IMPORTANT — reuse, don't rebuild)

| New design concept | Existing implementation | Action |
|---|---|---|
| Sidebar + main content shell | `app/src/components/dashboard-shell.tsx` | Reuse as-is |
| Role-filtered nav | `app/src/lib/admin-nav.tsx`, `app/src/lib/member-nav.tsx` | Extend with NETWORK_HEAD + classification items |
| Roles | `app.users.role` text column, hierarchy in `lib/auth` | Insert `NETWORK_HEAD` between MINISTRY_HEAD and ADMIN |
| Inner Circle / Joshua Generation | Lifecycle stages "Inner Core" / "Joshua Generation" in `membership.lifecycle_stage` | Treat as **member classification** derived from lifecycle stage; "Inner Circle" = existing "Inner Core" |
| Networks | `ministries.network` table (exists) | Add `head_member_id`; build `/network` surface |
| Ministries/chapters | `ministries.ministry`, `ministry_chapter`, `ministry_membership`, `join_request` | Reuse |
| Attendance | `attendance.check_in`, `visitor_capture`, QR scanner | Reuse |
| Journey tracking | `membership.lifecycle_stage` (data-driven rows) + member's current stage | Add `journey_progress` history table + stage requirements |
| Announcements | `communications.announcement` + fan-out + Resend email | Reuse |
| Follow-ups, prayer requests, care notes, tasks, activity logs | **Do not exist** | New `care` schema + new modules |

---

## 2. Role-Based Dashboard Design

All dashboards render inside the same `DashboardShell`. Differences = nav items + landing page widgets.

### 2.1 Super Admin Dashboard (`/members` landing, full admin sidebar)

- **Purpose:** System health + total oversight.
- **Key widgets:** Total members (by stage), weekly attendance trend chart (exists: `trend-chart.tsx`), pending applications count, pending join requests, users by role, recent activity log feed, email delivery status.
- **Main actions:** Manage users/roles (`/users`), approve anything, jump to any module, manage settings.
- **Data shown:** Org-wide; no scoping.

### 2.2 Admin Dashboard (same as Super Admin minus Users + Settings)

- **Purpose:** Daily operations.
- **Key widgets:** Today's events + check-in counts, FTV captures this week, members needing follow-up (no attendance 3+ weeks), announcements drafts, applications queue.
- **Main actions:** Member CRUD, attendance ops, event ops, announcements, reports.

### 2.3 Network Head Dashboard (`/network`) — NEW SURFACE

- **Purpose:** Monitor all ministries in the assigned network.
- **Key widgets:** Ministries in network (cards: head, member count, attendance rate), network attendance trend, journey stage distribution across network, overdue follow-ups by ministry, ministry report submission status (submitted/late), tasks assigned to heads.
- **Main actions:** Drill into any ministry, message/assign tasks to ministry heads, review submitted ministry reports, export network report.
- **Data shown:** Scoped to ministries where `ministry.network_id` = their network(s).

### 2.4 Ministry Head Dashboard (`/ministry`) — EXISTS, EXTEND

- **Purpose:** Run one ministry chapter.
- **Key widgets:** My members list w/ journey stage badges, pending join requests (exists), attendance last 4 weeks, members at risk (missed 3+ weeks), open follow-ups, open tasks, recent care notes.
- **Main actions:** Approve/reject join requests (exists), record attendance, create follow-up, add care note, assign task to Inner Circle, submit weekly ministry report, request stage promotion.
- **Data shown:** Scoped to their chapter(s) via `ministry_membership.is_leader = true`.

### 2.5 Inner Circle Dashboard (`/me` + extra "My Flock" section)

- **Purpose:** Help shepherd a small assigned group.
- **Key widgets:** Own journey card (exists), "My Flock" list (assigned members + last attendance + stage), my open follow-ups, my tasks, flock prayer requests.
- **Main actions:** Log follow-up outcome, add basic care note (non-sensitive), mark task done, view flock member profile (limited).
- **Data shown:** Own data + members where `follow_up.assigned_to` or `flock_assignment.shepherd_member_id` = them.

### 2.6 Joshua Generation Dashboard (`/me`) — EXISTS

- **Purpose:** See own growth; engage.
- **Key widgets:** Journey ladder (exists: `journey-ladder.tsx`), my attendance (exists), my ministries (exists), announcements (exists), my prayer requests + status, upcoming events/calendar.
- **Main actions:** Join ministry request (exists), submit prayer request, view next-step requirements ("what do I need for Joshua Generation?"), RSVP events.

---

## 3. Sidebar Navigation System (GHL-style)

Shell behavior (already implemented in `dashboard-shell.tsx`): fixed sidebar ≥ md breakpoint, hamburger → animated drawer < md, active-pill animation, Escape/route-change closes drawer, user card + logout at bottom. **Add:** collapse-to-icons toggle (persist in `localStorage`), section headers.

### Sidebar sections & role visibility

| Section | Item | Icon (lucide) | SUPER | ADMIN | NET HEAD | MIN HEAD | INNER C | JOSHUA |
|---|---|---|---|---|---|---|---|---|
| — | Dashboard / Overview | `layout-dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **People** | Members | `users` | ✅ | ✅ | 👁 network | 👁 ministry | ❌ | ❌ |
| | Applications | `user-plus` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | My Flock | `heart-handshake` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Engagement** | Events | `calendar-days` | ✅ | ✅ | 👁 | 👁 | ✅ | ✅ |
| | Attendance | `qr-code` | ✅ | ✅ | 👁 network | ✅ ministry | ❌ | 👁 own |
| | Calendar | `calendar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Growth** | Journey Tracker | `trending-up` | ✅ | ✅ | 👁 network | ✅ ministry | 👁 flock | 👁 own |
| | Discipleship (Programs/Education) | `book-open` | ✅ | ✅ | 👁 | 👁 | ❌ | 👁 own |
| **Care** | Follow-ups | `phone-call` | ✅ | ✅ | 👁 network | ✅ | ✅ assigned | ❌ |
| | Prayer Requests | `hand-helping` | ✅ | ✅ | 👁 | ✅ ministry | 👁 flock | ✅ own |
| | Care Notes | `notebook-pen` | ✅ | ✅ | ❌ | ✅ ministry | ✅ basic | ❌ |
| | Tasks | `check-square` | ✅ | ✅ | ✅ | ✅ | ✅ own | ❌ |
| **Organization** | Networks | `git-branch` | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| | Ministries | `church` | ✅ | ✅ | 👁 own | ✅ own | 👁 own | ✅ join |
| | Missions / Scholarships | `globe` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Comms** | Announcements | `megaphone` | ✅ | ✅ | ✅ network | ✅ ministry | 👁 | 👁 |
| | GHL Sync | `refresh-cw` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Insights** | Reports | `bar-chart-3` | ✅ | ✅ | ✅ network | ✅ ministry | ❌ | ❌ |
| **System** | Users & Roles | `shield` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Settings | `settings` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Activity Log | `scroll-text` | ✅ | ✅ 👁 | ❌ | ❌ | ❌ | ❌ |

✅ = full, 👁 = read-only/scoped, ❌ = hidden. Nav filtering stays UI-only; enforcement is middleware + `requireRole()`/scope checks server-side.

Implementation: extend `adminNavForRole()` / `memberNavForRole()` into one `navForUser(user)` that takes `{role, classification, headOfNetworkIds, headOfChapterIds}`.

---

## 4. Core Modules

| Module | Status | Access | Key screens | Main features / actions |
|---|---|---|---|---|
| **User Management** | EXISTS (`/users`) | SUPER | Users table, invite form | Create user, set role, activate/deactivate, reset password, link to person |
| **Role & Permission Mgmt** | Partial (hierarchy only) | SUPER | Role matrix screen | Assign role; per-module permission overrides (phase 2 — start with fixed matrix §5) |
| **Member Management** | EXISTS (`/members`) | SUPER/ADMIN; scoped read for heads | List + filters, member profile, edit form | CRUD, classification, stage override, portal link, GHL sync |
| **Network Management** | Schema exists, no UI | SUPER/ADMIN manage; NET HEAD view own | Networks list, network detail (ministries, heads, stats) | Create network, assign head, move ministries |
| **Ministry Management** | EXISTS (`/ministries`, `/ministry`) | SUPER/ADMIN; MIN HEAD own | Ministry detail, members, join requests | CRUD, assign head, approve joins, manage chapter |
| **Attendance Tracking** | EXISTS (QR + dashboard) | SUPER/ADMIN; MIN HEAD scoped | Scanner, event check-in list, trends | QR/manual check-in, FTV capture, bulk import |
| **Christian Journey Tracking** | Partial (stage on member) | All (scoped) | Journey tracker board, member journey timeline | Stage history, requirements checklist, promote/demote w/ audit (§6) |
| **Discipleship Monitoring** | EXISTS (Programs/Heartlink, BC, ISU, BAC) | SUPER/ADMIN; read for heads | Cohorts, enrollments, completions | Link completions to journey requirements |
| **Follow-up System** | NEW | ADMIN+, heads, Inner Circle (assigned) | Follow-up queue, follow-up detail | Create (manual or auto-trigger: FTV, 3-week absence), assign, log outcome, due dates |
| **Prayer Requests** | NEW | Member submits; leaders view scoped | My requests, ministry prayer board | Submit (private/leaders-only/public), mark praying/answered |
| **Care Notes** | NEW | MIN HEAD+ full; Inner Circle basic | Notes timeline on member profile | Add note (sensitivity: GENERAL vs SENSITIVE), SENSITIVE visible MIN HEAD+ only |
| **Task Management** | NEW | ADMIN+/heads assign; assignee completes | Task board (todo/doing/done), my tasks | Create, assign (to head or Inner Circle), due date, status |
| **Announcements** | EXISTS + email | SUPER/ADMIN; heads scoped (phase 2) | Compose, recipients, delivery status | Publish → fan-out → Resend email |
| **Reports & Analytics** | Partial (attendance trends) | SUPER/ADMIN org-wide; heads scoped | Reports hub, per-report screens | §13 |
| **Settings** | NEW | SUPER | Org profile, stages config, branches, integrations | Edit stage ladder/requirements, email/GHL config |

---

## 5. Permission Matrix

| Capability | SUPER | ADMIN | NET HEAD | MIN HEAD | INNER CIRCLE | JOSHUA GEN |
|---|---|---|---|---|---|---|
| View members | All | All | Network | Ministry | Flock (limited fields) | Self |
| Create members | ✅ | ✅ | ❌ | ❌ (FTV capture only) | ❌ | ❌ |
| Edit members | ✅ | ✅ | ❌ | Contact notes only | ❌ | Own profile |
| Delete (soft) members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve (applications/joins/promotions) | ✅ | ✅ | Promotions in network | Join requests; request promotion | ❌ | ❌ |
| Assign (roles) | ✅ | Roles < ADMIN | ❌ | ❌ | ❌ | ❌ |
| Assign (tasks/follow-ups/flock) | ✅ | ✅ | To ministry heads | To Inner Circle | ❌ | ❌ |
| Attendance: record | ✅ | ✅ | ❌ | Own ministry events | ❌ | Self check-in (QR) |
| Journey stage: update | ✅ | ✅ | Approve in network | Request | ❌ | ❌ |
| Care notes: GENERAL | ✅ | ✅ | View network | ✅ ministry | Create/view own-authored | ❌ |
| Care notes: SENSITIVE | ✅ | ✅ | ❌ | Own ministry | ❌ | ❌ |
| Prayer requests | All | All | Network (non-private) | Ministry (non-private) | Flock (non-private) | Own |
| Export reports | ✅ | ✅ | Network | Ministry | ❌ | ❌ |
| Manage settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View activity logs | ✅ | View | ❌ | ❌ | ❌ | ❌ |

Enforcement layers: 1) middleware route guard (`app/src/middleware.ts` — edge, JWT only), 2) `requireRole()` in server actions, 3) **new** `scopeFor(user)` helper returning allowed network/chapter/member IDs applied to every query.

---

## 6. Christian Journey Tracking System

Keep `membership.lifecycle_stage` as the data-driven ladder (stages are DB rows — renaming/extending needs no migration of logic). Proposed ladder merges existing stages with requested ones:

| # | Stage (DB row) | Maps to requested | Description | Required data | Who updates | Trigger to next |
|---|---|---|---|---|---|---|
| 1 | First Time Visitor | New Believer (entry) | Captured via FTV at an event | `visitor_capture` row, consent | Auto on FTV capture | 2nd check-in within 8 weeks |
| 2 | Ongoing Visitor | Regular Attendee (early) | Returns occasionally | ≥2 check-ins | Auto suggest; ADMIN confirm | 4 check-ins in 8 weeks |
| 3 | Regular Attendee | Regular Attendee | Consistent Sunday attendance | Attendance rate ≥50% (8 wks) | Auto suggest; ADMIN confirm | Membership application approved |
| 4 | Regular Member | Small Group Member | Formal member; in a small group/ministry | Approved application; active `ministry_membership` | ADMIN | Enrolls in discipleship (Heartlink/BC/ISU) |
| 5 | Under Discipleship *(new row)* | Under Discipleship | In a discipleship program | Active enrollment | Auto on enrollment; MIN HEAD request | Program completion + serving |
| 6 | Joshua Generation | Serving in Ministry | Serving; being raised as leader. **Classification = JOSHUA_GEN** | Completion record; serving role | MIN HEAD request → NET HEAD/ADMIN approve | Leads others (flock assigned / leader role) |
| 7 | Inner Core | Leading Others → Mature Disciple. **Classification = INNER_CIRCLE** | Proven leader-helper | Flock assignment or `leader_role`; head endorsement | NET HEAD/ADMIN approve | Eligible for MINISTRY_HEAD role |

- **Progress indicators:** per-stage requirements checklist (auto-computed: attendance %, enrollment, completion, ministry membership) + manual endorsements. Member sees own checklist on `/me` ("Next step: Joshua Generation — 2 of 3 requirements met").
- **History:** every change writes a `journey_progress` row (old stage, new stage, reason, changed_by, evidence link). Promotion to stage 6+ uses request→approve flow (`stage_promotion_request`).
- **Demotion/inactivity:** auto-flag (not auto-demote) when attendance drops; creates a follow-up instead.

---

## 7. Data Structure / Database Design

Existing schemas stay (core, membership, events, attendance, programs, education, ministries, missions, communications, app). **New migrations (V070+), new `care` schema.** Existing tables listed for context; new tables marked 🆕.

| Table | Purpose | Important fields | Relationships |
|---|---|---|---|
| `app.users` | Login accounts | user_id, email, password_hash, **role**, person_id, is_active | → core.person |
| 🆕 `app.permission_override` (phase 2) | Per-user module grants | user_id, module, capability, allowed | → users |
| `core.person` | Human identity | person_id, names, birth_date, ghl_contact_id | ← member, check_in, users |
| `membership.member` | Church member record | member_id, person_id, branch_id, current lifecycle stage, joined_on | → person, lifecycle_stage |
| `membership.lifecycle_stage` | Journey ladder config | stage_id, code, name, sort_order; 🆕 add `classification` (NULL/JOSHUA_GEN/INNER_CIRCLE), `requirements jsonb` | ← member, journey_progress |
| `membership.role`, `member_role` | Church (non-app) roles | — | existing |
| 🆕 `membership.journey_progress` | Stage history | progress_id, member_id, from_stage_id, to_stage_id, reason, evidence_url, changed_by_user_id, changed_at | → member, lifecycle_stage, users |
| 🆕 `membership.stage_promotion_request` | Promote approval flow | request_id, member_id, to_stage_id, requested_by, status (PENDING/APPROVED/REJECTED), decided_by, decided_at, note | → member, stage |
| `ministries.network` | Networks | network_id, code, name; 🆕 add `head_member_id` | ← ministry |
| `ministries.ministry` / `ministry_chapter` / `ministry_membership` | Ministry org + membership | leader_role (HEAD/ASSISTANT_HEAD/COORDINATOR), is_leader | existing |
| `ministries.join_request` | FB-style join flow | status, priority | existing |
| 🆕 `ministries.flock_assignment` | Inner Circle ↔ assigned members | assignment_id, shepherd_member_id, member_id, chapter_id, assigned_by, started_at, ended_at | → member ×2, chapter |
| `attendance.check_in` / `visitor_capture` | Attendance + FTV | — | existing |
| 🆕 `care.follow_up` | Follow-up records | follow_up_id, member_id, type (FTV/ABSENCE/NEW_BELIEVER/CUSTOM), assigned_to_member_id, due_on, status (OPEN/DONE/NO_CONTACT), outcome_note, created_by, completed_at | → member ×2 |
| 🆕 `care.prayer_request` | Prayer requests | prayer_id, member_id, body, visibility (PRIVATE/LEADERS/PUBLIC), status (OPEN/PRAYING/ANSWERED), answered_note, created_at | → member |
| 🆕 `care.care_note` | Pastoral notes | note_id, member_id, author_user_id, body, sensitivity (GENERAL/SENSITIVE), created_at | → member, users |
| 🆕 `care.task` | Task management | task_id, title, description, assigned_to_member_id, created_by_user_id, scope (chapter_id/network_id nullable), due_on, status (TODO/IN_PROGRESS/DONE), completed_at | → member, users |
| 🆕 `care.ministry_report` | Weekly head reports | report_id, chapter_id, period_start/end, attendance_count, new_members, highlights, concerns, submitted_by, submitted_at, reviewed_by | → chapter |
| `communications.announcement` (+ recipients) | Announcements + email | delivered_at | existing |
| 🆕 `app.activity_log` | Audit trail | log_id, user_id, action, entity_type, entity_id, before jsonb, after jsonb, ip, created_at | → users |
| 🆕 `app.setting` | Org settings | key, value jsonb, updated_by, updated_at | — |
| Programs/Education/Missions tables | Discipleship data | — | existing; journey requirements read from these |

Reports = computed views/queries, not tables (except optional `care.ministry_report` above).

---

## 8. User Flows

1. **Login & dashboard access:** `/login` (credentials or Google) → NextAuth JWT (role + personId claims) → middleware routes by role → ADMIN+ lands `/members`, NET HEAD `/network`, MIN HEAD `/ministry`, members `/me`. Sidebar = `navForUser()`.
2. **Add new member:** Admin → Members → "Add member" → person + member form (Zod) → optionally link login invite → stage set (default Regular Member if direct add) → activity log row.
3. **Assign member to network/ministry:** Admin/Head → Ministry detail → Members tab → "Add member" (or member's join request approved) → `ministry_membership` row → member's `/me` Ministries updates; network implied via ministry.network_id.
4. **Update attendance:** Usher/Admin → Attendance → select event → QR scan (`QrScanner`) or search+manual check-in → `check_in` row → unknown face → FTV capture flow → auto-creates FTV follow-up.
5. **Track journey progress:** nightly job (or on-view computation) evaluates requirements → flags "ready for next stage" on member profile + Journey Tracker board → leader reviews evidence → confirms (≤ stage 5) or files promotion request (stage 6+).
6. **Create follow-up:** auto (FTV capture; 3-week absence scan) or manual (member profile → "New follow-up") → assign to Inner Circle/head → assignee sees in My Follow-ups → logs outcome → status DONE → journey/care timeline updated.
7. **Promote Joshua Gen → Inner Circle:** MIN HEAD on member profile → "Request promotion" → `stage_promotion_request` PENDING → NET HEAD/ADMIN reviews checklist + endorsement → Approve → stage updated, classification flips to INNER_CIRCLE, `journey_progress` + activity log rows, member notified (announcement/email).
8. **Assign task:** Head/Admin → Tasks → "New task" → title, assignee (scoped picker), due date → assignee's dashboard widget + My Tasks → mark done → completion rate feeds reports.
9. **Submit ministry report:** MIN HEAD → Ministry → Reports tab → weekly form (attendance auto-prefilled from check-ins, add highlights/concerns) → submit → NET HEAD dashboard shows submitted/late → NET HEAD reviews → marks reviewed.
10. **Generate analytics report:** Admin/Head → Reports → pick report + filters (date range, branch/network/ministry) → server-rendered charts (`trend-chart.tsx` pattern) → "Export CSV" via server action streaming.

---

## 9. Page & Screen Structure

| Page | Route | Purpose | Main sections | Actions | Layout |
|---|---|---|---|---|---|
| Login | `/login` (exists) | Auth | Credentials, Google, link to signup | Sign in | Split panel (exists) |
| Main Dashboard | `/members` (admin), `/network`, `/ministry`, `/me` | Role landing | Role widgets (§2) | Role actions | Shell + card grid |
| Member List | `/members` (exists) | Browse/manage | Filter bar (stage/classification/ministry/branch/status), table, pagination | Add, export, bulk tag | Shell + table |
| Member Profile | `/members/[id]` (exists, extend) | 360° view | Header card; tabs: Journey, Attendance, Ministries, Care (follow-ups/notes/prayer), Discipleship, Roles/PCM/Application (exist) | Edit, promote, new follow-up, new note, portal link | Shell + tabs |
| Attendance | `/events/attendance` (exists) | Check-in ops + trends | Stat cards, trend chart, event check-in list, scanner | Scan, manual check-in, FTV capture | Shell |
| Journey Tracker | `/journey` 🆕 | Pipeline view | Kanban-ish columns per stage w/ counts; "ready to advance" flags; filters | Confirm advance, request promotion | Shell + board |
| Follow-ups | `/care/follow-ups` 🆕 | Queue | Tabs: Open / Mine / Done; table w/ due dates, overdue badges | Create, assign, log outcome | Shell + table |
| Ministry Page | `/ministry` (exists, extend) | Head workspace | Members, join requests, attendance, follow-ups, tasks, reports tabs | Approve, record, submit report | Shell + tabs |
| Network Page | `/network` 🆕 | Network head workspace | Ministry cards, trends, report status, promotion queue | Drill in, assign task, approve promotion | Shell + card grid |
| Reports | `/reports` 🆕 | Analytics hub | Report cards → detail pages w/ filters + charts | Export CSV | Shell |
| Tasks | `/care/tasks` 🆕 | Work tracking | Board (TODO/IN PROGRESS/DONE) or list; "My tasks" | Create, assign, complete | Shell + board |
| Announcements | `/announcements` (exists) | Comms | List, compose, recipients, delivery status | Publish (sends email) | Shell |
| Settings | `/settings` 🆕 | Org config | Org profile, journey stages editor, branches, integrations (Resend/GHL), security | Save (audited) | Shell + sections |
| Prayer board | `/care/prayer` 🆕 + `/me` widget | Prayer | Scoped board, my requests | Submit, mark praying/answered | Shell |

---

## 10. Component System

Existing (reuse): `DashboardShell`, `ThemeToggle`, `trend-chart.tsx`, `journey-ladder.tsx`, `motion-card.tsx`, `animated-number.tsx`, `member-form`, `member-search`, `QrScanner`.

New/standardize (in `app/src/components/ui/`):

| Component | Notes |
|---|---|
| `AppShell` | = `DashboardShell`; add collapsible-to-icons mode |
| `PageHeader` | Title + breadcrumb + action buttons slot |
| `StatCard` | Label, value (`AnimatedNumber`), delta arrow, icon |
| `DataTable` | Generic: columns def, sort, pagination, row click, empty state; server-driven |
| `FilterBar` | Composable selects/date-range/search; syncs to URL searchParams |
| `MemberCard` | Avatar initials, name, stage `StatusBadge`, ministry chips |
| `JourneyTimeline` | Vertical history from `journey_progress` (extends `journey-ladder`) |
| `StatusBadge` | Variants: stage, request status, task status, sensitivity |
| `SearchBar` | Debounced, server action backed (pattern exists in `member-search`) |
| `FormField` wrappers | Label + input + Zod error slot; consistent across forms |
| `Modal` / `ConfirmDialog` | Focus-trapped; destructive variant for deletes |
| `Toast` | Success/error after server actions (add `sonner` or hand-rolled) |
| `ReportChart` | Server-rendered SVG (extend `trend-chart.tsx`: bar, line, donut) |
| `EmptyState` | Icon + message + CTA (e.g. "No follow-ups — create one") |
| `Skeleton` | Loading states via Suspense fallbacks per route segment |

---

## 11. System Architecture

Keep current architecture; extend.

- **Frontend:** Next.js 14 App Router, RSC-first; client components only for interactivity (shell, scanner, forms, motion). Route groups: `(admin)`, 🆕 `(network)`, `me/`, `ministry/`, `church/` (public), `care/` shared-scoped.
- **Backend:** Server actions per module in `app/src/actions/` (pattern exists). No separate API server. Route handlers only for: NextAuth, ICS download (exists), CSV export, webhook receivers (GHL).
- **Auth:** NextAuth v5 JWT (credentials + Google w/ DB allowlist). Add `role`, `classification`, `personId` to token/session claims.
- **Authorization:** middleware (route-level, edge — `getToken` only) → `requireRole()` (action-level) → 🆕 `scopeFor(user)` (row-level: returns allowed chapter/network/member id sets; every scoped query filters by it). Never trust nav visibility.
- **Database:** PostgreSQL 16 (Neon prod), Drizzle ORM, Flyway versioned migrations (next: V070+). New `care` schema. Schema changes ALWAYS via migration + matching `app/src/schema/` edit.
- **API structure:** server actions validated with Zod (`lib/validations/`), return `{ok, data|error}`; redirect-safe error handling (per `22bb12d` lesson).
- **File upload:** small scale — Vercel Blob (or UploadThing) for member photos/report attachments; store URL + uploaded_by; validate MIME + size server-side.
- **Activity logging:** `logActivity(user, action, entity, before, after)` helper called inside mutating actions; fire-and-forget insert to `app.activity_log`.
- **Notifications:** in-app (dashboard widgets/badges) + email via existing Resend integration (verify domain first — pending human action); optional SMS via existing GHL integration (`lib/ghl.ts`).
- **Security:** see §14.

---

## 12. API Design (server actions + route handlers)

Format: `action` = server action in `src/actions/`; `GET` = route handler. Roles = minimum.

| Module | Endpoint/Action | Purpose | Allowed roles |
|---|---|---|---|
| Auth | `POST /api/auth/*` (NextAuth) | Sign in/out/session | Public |
| Users | `createUser`, `updateUserRole`, `deactivateUser` | Account mgmt | SUPER (ADMIN: roles < ADMIN) |
| Members | `createMember`, `updateMember`, `archiveMember` | CRUD | ADMIN |
| | `getMembers(filter)` | Scoped list | NET/MIN HEAD (scoped) |
| | `updateOwnProfile` | Self-edit | MEMBER |
| Ministries | `createMinistry`, `assignHead`, `decideJoinRequest` | Org mgmt | ADMIN / MIN HEAD (joins) |
| | `requestJoin(chapterId, priority)` | Member join | MEMBER |
| Networks | `createNetwork`, `assignNetworkHead`, `moveMinistry` | Network mgmt | ADMIN |
| Attendance | `checkIn(eventId, personId)`, `captureFtv(...)` | Record | ADMIN, MIN HEAD (own events) |
| | `GET /api/attendance/export?range=` | CSV | ADMIN; heads scoped |
| Journey | `confirmStageChange(memberId, toStage, reason)` | Stages 1–5 | ADMIN |
| | `requestPromotion(memberId, toStage, note)` | Stage 6+ request | MIN HEAD |
| | `decidePromotion(requestId, decision)` | Approve/reject | NET HEAD (network) / ADMIN |
| Follow-ups | `createFollowUp`, `assignFollowUp`, `completeFollowUp(outcome)` | Care loop | MIN HEAD+; INNER_CIRCLE complete-own |
| Prayer | `submitPrayerRequest(visibility)`, `updatePrayerStatus` | Prayer | MEMBER submit; leaders update (scoped) |
| Care notes | `addCareNote(sensitivity)` | Notes | MIN HEAD+ (SENSITIVE); INNER_CIRCLE (GENERAL, flock) |
| Tasks | `createTask`, `updateTaskStatus` | Tasks | Heads+ create; assignee update |
| Reports | `getReport(name, filters)`, `GET /api/reports/[name]/export` | Analytics | ADMIN; heads scoped |
| | `submitMinistryReport`, `reviewMinistryReport` | Head reports | MIN HEAD / NET HEAD |
| Settings | `updateSetting(key, value)`, `updateStageConfig` | Config | SUPER |

Every mutating action: Zod validate → `requireRole` → scope check → mutate → `logActivity` → `revalidatePath`.

---

## 13. Reports & Analytics

Hub at `/reports`; each report = server component + filters + `ReportChart` + CSV export. Heads get scoped versions automatically via `scopeFor()`.

| Report | Source | Visual |
|---|---|---|
| Total members (by branch/stage/classification) | `member` × `lifecycle_stage` | Stat cards + donut |
| Active vs inactive | check-ins last 8 weeks vs none | Donut + table of inactive (links to create follow-ups) |
| Attendance trends | `check_in` weekly buckets (exists: `attendance-trends.ts` — extend) | Line/bar |
| Journey stage distribution | `member.stage` + `journey_progress` velocity (avg days per stage) | Funnel + movement table |
| Follow-up status | `follow_up` by status/type/assignee, overdue % | Stacked bar |
| Ministry growth | `ministry_membership` joins − exits per month | Line per ministry |
| Network performance | Roll-up: attendance rate, growth, report submission %, follow-up closure per network | Scorecard table |
| Leadership activity | Tasks done, follow-ups closed, reports on time per head/Inner Circle | Leaderboard table |
| Prayer summary | Counts by status; answered this month (no bodies for PRIVATE) | Stat cards |
| Task completion rate | done/total by scope and assignee | Bar |

---

## 14. Security & Access Control

- **Login:** bcrypt password hashing (exists), Google OAuth w/ DB allowlist (exists), rate-limit login attempts (add — e.g. upstash or in-DB counter), generic error messages.
- **Protected routes:** `app/src/middleware.ts` guards ALL non-public routes (exists; keep edge-safe — `getToken` only, never import db). Add `/network`, `/care/*`, `/reports`, `/settings` matchers.
- **RBAC:** role hierarchy + scope checks server-side on every action/query (§5, §11). Nav hiding is cosmetic only.
- **Data privacy:** members see only own data; Inner Circle sees limited flock fields (name, stage, attendance — no contact details unless granted); PRIVATE prayer requests visible to author + SUPER only.
- **Audit logs:** `app.activity_log` on every mutation; viewable `/settings/activity` (SUPER full, ADMIN read).
- **Permission checks:** single `can(user, capability, resource)` helper encoding §5 — used by both nav and actions so matrix lives in ONE place (`lib/permissions.ts`, unit-tested).
- **Safe deletion:** soft-delete (`archived_at`/`is_active`) for members, users, ministries; hard delete = SUPER only + confirm dialog + audit row. DB FKs prevent orphaning.
- **Sensitive notes:** `care_note.sensitivity = SENSITIVE` → query-level filter (never filter in UI); excluded from exports unless SUPER.
- **Secrets:** env vars only (`app/.env` untracked — existing rule); session JWT secure cookies (hardening exists `8a5aa30`).

---

## 15. Developer Handoff

### Folder structure (extends existing)

```
app/src/
├── actions/            # + follow-ups.ts, prayer.ts, care-notes.ts, tasks.ts, journey.ts, networks.ts, reports.ts, settings.ts
├── app/
│   ├── (admin)/        # + journey/, reports/, settings/, care/{follow-ups,tasks,prayer}/
│   ├── network/        # 🆕 NET HEAD surface (layout → DashboardShell)
│   ├── ministry/       # extend tabs
│   ├── me/             # + prayer/, flock/ (Inner Circle)
│   └── church/         # unchanged (public)
├── components/ui/      # 🆕 DataTable, StatCard, FilterBar, Modal, Toast, EmptyState, StatusBadge...
├── lib/
│   ├── permissions.ts  # 🆕 can() + matrix (single source of truth)
│   ├── scope.ts        # 🆕 scopeFor(user)
│   ├── activity-log.ts # 🆕
│   └── nav.ts          # navForUser() merging admin-nav + member-nav
└── schema/care.ts      # 🆕 follow_up, prayer_request, care_note, task, ministry_report
db/migrations/V070__*.sql ...   # care schema, NETWORK_HEAD role, lifecycle additions, activity_log, settings, flock_assignment
```

### Build order (suggested PRs)

1. **V070 migrations + `care.ts` schema + permissions/scope helpers** (unit-test matrix)
2. **NETWORK_HEAD role + `/network` surface** (nav, middleware, dashboard)
3. **Journey tracking v2** (journey_progress, promotion requests, tracker page, `/me` checklist)
4. **Follow-ups + flock assignments** (incl. auto-triggers: FTV, absence scan)
5. **Care notes + prayer requests**
6. **Tasks + ministry reports**
7. **Reports hub + exports**
8. **Settings + activity log UI**

### Conventions

- **State management:** none client-side beyond React state — RSC + server actions + `revalidatePath` is the pattern; URL searchParams for filters. Do not add Redux/Zustand.
- **Error handling:** actions return `{ok:false, error}` → form-level display; never swallow `redirect()` (lesson `22bb12d`); error.tsx boundaries per route group.
- **Loading:** `loading.tsx` + Suspense skeletons per new route.
- **Empty states:** every list/table renders `EmptyState` with a CTA.
- **Testing:** unit-test `permissions.ts`, `scope.ts`, journey requirement evaluators (Vitest, pattern: `attendance-trends.ts` tests); E2E per surface (pattern: `member-dashboard.spec.ts`); always run E2E vs LOCAL db, never Neon.
- **Migrations:** every `schema/` change ships a Flyway `V0XX__` file; never edit applied migrations.
