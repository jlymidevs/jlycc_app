# Ministries Leaders Redesign — Design Spec

**Date:** 2026-06-12
**Status:** Approved for implementation

---

## Overview

Redesign the `/ministries` admin page into a 2-column layout that combines the ministry/network tree with a live leaders panel. Super admins can appoint and remove Network Heads, Ministry Heads, and Inner Core members directly from this page without navigating away.

---

## Scope

| In scope | Out of scope |
|---|---|
| `/ministries` page redesign (2-col layout) | Changes to `/ministries/[id]` detail page |
| Network Head appointment/removal | Ministry chapter create/edit |
| Ministry Head appointment/removal | Join request flow |
| Inner Core appointment/removal | Member lifecycle stage changes |
| Add ministry per network (+ button) | Network create/delete |
| Delete ministry per network (− button, soft-delete) | |

---

## Role Hierarchy (Reference)

```
Network Head   — 1 per network, appointed explicitly
Ministry Head  — 1 per chapter, appointed explicitly
Inner Core     — unlimited per chapter, appointed explicitly
Joshua Gen.    — regular ministry members (not appointed)
```

Appointment eligibility:
- **Network Head / Ministry Head**: members with `INNER_CORE` or `JOSHUA_GENERATION` lifecycle stage only
- **Inner Core**: any active member already in that chapter

---

## Page Layout

`/ministries` becomes a 2-column layout:

```
┌──────────────────────────────┬───────────────────────────────┐
│  Left panel (60%)            │  Right panel (40%, sticky)    │
│  Network + ministry tree     │  Leaders sidebar              │
└──────────────────────────────┴───────────────────────────────┘
```

---

## Left Panel — Network & Ministry Tree

- Each **network** = bold section header
- Under each network: list of its ministries
- Each **ministry row**:
  - Ministry name (link to `/ministries/[id]`)
  - Leader name as muted sub-text below the name (or "Vacant" in gray italic)
  - `[−]` delete icon on the right (soft-delete with confirm dialog)
- Below each network's ministry list: `[+ Add ministry]` button
  - Clicking opens an inline form: ministry name input + confirm/cancel
  - On submit: creates ministry + default chapter for current branch

---

## Right Panel — Leaders Sidebar

Sticky, scrolls independently. Grouped by network → chapters.

```
LEADERS
────────────────────────────
Eagles
  Network Head
  Juan dela Cruz    [× Remove]

  Move Ministry
   Ministry Head
   Maria Santos     [× Remove]
   Inner Core (2)   [+ Appoint]
   • Ana Reyes      [×]
   • Ben Torres     [×]

  CCEM
   Ministry Head
   Vacant           [+ Appoint]
   Inner Core (0)   [+ Appoint]
────────────────────────────
Wind
  Network Head
  Vacant            [+ Appoint]
  ...
```

Enforcement rules:
- Network Head slot: if filled → show name + `[× Remove]` only; `[+ Appoint]` hidden
- Ministry Head slot: same, 1 per chapter
- Inner Core: no cap; `[+ Appoint]` always visible; each member has `[×]` remove

---

## Appointment Modal

Triggered by any `[+ Appoint]` click. Modal title reflects context (e.g. "Appoint Network Head — Eagles").

- Member search input (debounced, server fetch)
- Results list: full name + lifecycle stage chip + branch
- Eligibility filters applied server-side (see Role Hierarchy above)
- Already-appointed members excluded from results
- Ministry Head / Inner Core candidates: must already be chapter members
- `[Confirm Appoint]` disabled until a member is selected
- On confirm: calls appropriate server action, modal closes, panel refreshes

---

## Data Layer

### DB Changes

**V073 — `ministries.network_leader`** (port from `feature/profile-appointment-hierarchy` worktree)
```sql
CREATE TABLE ministries.network_leader (
  network_leader_id BIGSERIAL PRIMARY KEY,
  network_id        BIGINT NOT NULL UNIQUE REFERENCES ministries.network(network_id) ON DELETE CASCADE,
  member_id         BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  appointed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  appointed_by      BIGINT REFERENCES membership.member(member_id)
);
```

**V074 — `is_inner_core` on `ministries.ministry_membership`**
```sql
ALTER TABLE ministries.ministry_membership
  ADD COLUMN is_inner_core BOOLEAN NOT NULL DEFAULT false;
```

**Drizzle schema updates**: `networkLeader` table + `isInnerCore` field on `ministryMembership`

### Server Actions (`app/src/actions/ministry-leaders.ts`)

| Action | Description |
|---|---|
| `appointNetworkHead(networkId, memberId)` | Upsert network_leader row |
| `removeNetworkHead(networkId)` | Delete network_leader row |
| `appointMinistryHead(chapterId, memberId)` | Insert/update ministry_membership HEAD row |
| `removeMinistryHead(chapterId)` | Clear HEAD from chapter |
| `appointInnerCore(chapterId, memberId)` | Set `is_inner_core=true` on membership |
| `removeInnerCore(membershipId)` | Set `is_inner_core=false` |
| `searchEligibleMembers(query, type, chapterId?)` | Filtered member search for modal |
| `addMinistry(networkId, name)` | Create ministry + default chapter |
| `closeMinistry(ministryId)` | Set all chapters to `status='CLOSED'`; hides from tree |

### Existing Schema Reuse

- Ministry Head uses existing `ministry_membership` with `is_leader=true, leader_role='HEAD'`
- Uniqueness of Ministry Head enforced via partial unique index: `(chapter_id) WHERE is_leader=true AND leader_role='HEAD'`

---

## Components

| Component | Type | Purpose |
|---|---|---|
| `MinistriesLeadersPage` | Server component | Fetches all data, renders 2-col layout |
| `NetworkTree` | Server component | Left panel: network + ministry rows |
| `AddMinistryForm` | Client component | Inline form per network |
| `LeadersSidebar` | Server component | Right panel: grouped leaders display |
| `AppointModal` | Client component | Member search + confirm modal |
| `LeaderSlot` | Client component | Single slot (filled or vacant) with appoint/remove |

---

## Migrations Summary

| Migration | Status |
|---|---|
| V073 `ministries.network_leader` | New — port from worktree |
| V074 `ministry_membership.is_inner_core` | New |

Both must run on Neon before Vercel deploy.
