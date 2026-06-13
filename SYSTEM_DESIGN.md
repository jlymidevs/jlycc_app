# JLYCC App — System Design

> **For Codex / agentic workers:** Read this file before touching any code.
> Current branch: `master`. State: clean (tsc ✓, 303/303 tests ✓, build ✓).

---

## What This Is

Church operations platform for JLY Church. Staff/admin portal + member-facing dashboard + public site.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript strict |
| Styling | Tailwind CSS |
| Auth | NextAuth.js v5 beta (JWT, edge-safe middleware) |
| ORM | Drizzle ORM + `postgres` driver |
| Database | PostgreSQL 16 (local Docker, prod Neon) |
| Migrations | Flyway SQL (`db/migrations/`) |
| Unit tests | Vitest (`app/tests/unit/`) |
| E2E tests | Playwright (`app/tests/e2e/`) |
| Email | Resend |

---

## Repository Layout

```
JLYCC App/
├── app/                          # Next.js application (cd here for npm commands)
│   ├── src/
│   │   ├── actions/              # Server actions (one file per domain)
│   │   ├── app/                  # App Router pages
│   │   │   ├── (admin)/          # Staff/admin pages (requires ADMIN+)
│   │   │   ├── (member)/         # Member-facing pages (/me/*)
│   │   │   └── (public)/         # Public pages (/church/*)
│   │   ├── components/           # Shared UI components
│   │   │   └── ministries/       # Ministries-specific components
│   │   ├── lib/                  # Auth, DB, helpers, validation
│   │   └── schema/               # Drizzle schema (mirrors DB schemas)
│   ├── tests/
│   │   ├── unit/                 # Vitest specs
│   │   └── e2e/                  # Playwright specs
│   └── package.json
├── db/
│   ├── migrations/               # Flyway V__ versioned + R__ repeatable seeds
│   ├── tests/                    # SQL pgTAP DB tests
│   └── docker-compose.yml
└── docs/superpowers/
    ├── plans/                    # Implementation plans (read before coding)
    └── specs/                    # Design specs
```

---

## Commands

```bash
# App
cd app
npm run dev              # dev server
npm run build            # production build
npx tsc --noEmit         # typecheck (must be clean before committing)
npx vitest run           # all unit tests
npx vitest run tests/unit/foo.test.ts   # single test file

# Database (local Docker)
cd db
docker compose up -d postgres
docker compose run --rm flyway migrate
docker compose run --rm flyway repair   # fix checksum mismatches on R__ files

# Verify local DB after migration
docker compose exec postgres psql -U jly_admin -d jly -c "SELECT ..."
```

---

## Database

### Local credentials
```
Host:     localhost:5432
DB:       jly
User:     jly_admin
Password: localdevpassword
URL:      postgresql://jly_admin:localdevpassword@localhost:5432/jly
```

**NEVER use the Neon/prod URL from `app/.env` for local dev, Flyway, or Playwright.**

### Schema namespaces (PostgreSQL schemas)

| Namespace | Purpose |
|---|---|
| `core` | Persons, branches |
| `membership` | Members, lifecycle stages |
| `ministries` | Networks, ministries, chapters, memberships, leaders |
| `events` | Events, registrations, attendance |
| `programs` | Heartlink, BAC |
| `education` | BC, ISU |
| `missions` | Scholarships |
| `communications` | Announcements |
| `app` | Users, sessions, auth |

### Migration naming

- `V075__description.sql` — versioned, runs once, never edit after run
- `R__seed_name.sql` — repeatable, re-runs whenever checksum changes
- Next versioned migration: **V076**

### Key tables (ministries domain)

```
ministries.network              — top-level grouping (Eagles, Wind, Wave)
ministries.ministry             — ministry under a network
ministries.ministry_chapter     — one chapter per ministry per branch
ministries.ministry_membership  — member joins a chapter
  .is_leader BOOLEAN            — true if HEAD
  .leader_role TEXT             — 'HEAD'
  .is_inner_core BOOLEAN        — explicit Inner Core appointment
ministries.network_leader       — append-only history of network head appointments
  .ended_at TIMESTAMPTZ NULL    — NULL = currently active
```

### FK cascade rules (important for migrations)

- `ministry_membership.chapter_id → ministry_chapter.chapter_id` **ON DELETE CASCADE**
- `network_leader.network_id → network.network_id` **ON DELETE CASCADE**
- `ministry.network_id → network.network_id` — **NO CASCADE** (delete chapters → ministries → networks in order)
- `ministry_chapter.ministry_id → ministry.ministry_id` — **NO CASCADE**

---

## Role Hierarchy

```
MEMBER < MINISTRY_HEAD < NETWORK_HEAD < ADMIN < SUPER_ADMIN
```

Defined in `app/src/lib/authz.ts`. Guard server actions with `requireRole("ADMIN")` from `app/src/lib/authz-server.ts`.

Appointment rules:
- **Network Head**: 1 per network, must be INNER_CORE or JOSHUA_GENERATION lifecycle stage
- **Ministry Head**: 1 per chapter, must be INNER_CORE or JOSHUA_GENERATION, must be active chapter member
- **Inner Core**: unlimited per chapter, any active chapter member

---

## Coding Patterns

### Server actions (`app/src/actions/`)

```typescript
"use server";
// imports...
export async function doSomething(id: number): Promise<{ success: true } | { error: string }> {
  await requireRole("ADMIN");
  try {
    // db operations
    revalidatePath("/some-page");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
```

- Pure helpers (no Next.js/NextAuth imports) go in `app/src/lib/` so Vitest can import them without server deps.
- `as unknown as number` casts on Drizzle bigint/number fields are an established pattern in this codebase — do not remove.

### Client components

```typescript
"use client";
import { useTransition, useState } from "react";
import { someAction } from "@/actions/domain";

export function MyButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await someAction(id); })}
    >
      {pending ? "…" : "Do it"}
    </button>
  );
}
```

### Drizzle queries

```typescript
import { db } from "@/lib/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { network, ministry } from "@/schema/ministries";

const rows = await db
  .select({ networkId: network.networkId, name: network.name })
  .from(network)
  .orderBy(network.name);
```

---

## Ministries Module — Current State

### Page: `/ministries`

2-column layout:
- **Left (60%)**: `NetworkTree` — lists networks → ministries, each with head sub-text, `CloseMinistryButton`, `AddMinistryForm` per network, `AddNetworkForm` at bottom
- **Right (40%, sticky)**: `LeadersSidebar` — shows Network Head + Ministry Head + Inner Core per chapter, appointment via `AppointModal`

### Key files

| File | Role |
|---|---|
| `app/src/actions/ministries.ts` | `getMinistries()` → `NetworkGroup[]` with `headName` |
| `app/src/actions/ministry-leaders.ts` | All appointment/removal actions + `addMinistry` + `addNetwork` |
| `app/src/lib/ministry-leader-eligibility.ts` | Pure `buildLeaderSearchWhere()` helper |
| `app/src/components/ministries/network-tree.tsx` | Left panel server component |
| `app/src/components/ministries/leaders-sidebar.tsx` | Right panel server component |
| `app/src/components/ministries/leader-slot.tsx` | Single leader slot (filled/vacant/appoint) |
| `app/src/components/ministries/appoint-modal.tsx` | Member search + confirm modal |
| `app/src/components/ministries/add-ministry-form.tsx` | Inline `+ Add ministry` per network |
| `app/src/components/ministries/add-network-form.tsx` | Inline `+ Add network` at page bottom |
| `app/src/components/ministries/close-ministry-button.tsx` | `×` soft-close per ministry row |

---

## Pending Task: Seed Overhaul

**Plan:** `docs/superpowers/plans/2026-06-13-ministries-seed-overhaul.md`
**Spec:** `docs/superpowers/specs/2026-06-13-ministries-seed-overhaul.md`

3 files to create/modify:

### 1. Create `db/migrations/V075__seed_overhaul_networks_ministries.sql`

```sql
DELETE FROM ministries.ministry_chapter;
DELETE FROM ministries.ministry;
DELETE FROM ministries.network;
```

### 2. Rewrite `db/migrations/R__seed_networks.sql`

```sql
INSERT INTO ministries.network (code, name, description) VALUES
  ('WIND',   'Wind',   'Wind network — multimedia, worship arts, creative and outreach.'),
  ('WAVE',   'Wave',   'Wave network — sound and lighting production.'),
  ('EAGLES', 'Eagles', 'Eagles network — children, education, leadership and development.')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;
```

### 3. Rewrite `db/migrations/R__seed_networks_ministries.sql`

```sql
INSERT INTO ministries.ministry (network_id, code, name, description, target_demographic) VALUES

  -- Wind (8)
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'ZOOM_MULTIMEDIA',  'ZOOM - Multimedia',  'Multimedia and media production ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'DAVIDIC_SYNFONIA', 'Davidic Synfonia',   'Worship and music ministry.',               NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'MOVE',             'Move',               'Creative movement and dance ministry.',      NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'GATE_KEEPERS',     'Gate Keepers',       'Prayer and intercession ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'SENTINELS',        'Sentinels',          'Security and ushering ministry.',            NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'FRONTLINERS',      'Frontliners',        'Evangelism and outreach ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'CREATIVES',        'Creatives',          'Graphic design and creative arts ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'), 'PRISM',            'Prism',              'Visual arts and display ministry.',          NULL),

  -- Wave (2)
  ((SELECT network_id FROM ministries.network WHERE code='WAVE'), 'SOUNDS',              'Sounds',              'Sound engineering and audio ministry.',   NULL),
  ((SELECT network_id FROM ministries.network WHERE code='WAVE'), 'ILLUMINATION_LIGHTS', 'Illumination - Lights','Lighting and production ministry.',     NULL),

  -- Eagles (7)
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'KINGDOM_KIDS', 'Kingdom Kids', 'Children''s ministry.',                   'Children'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'CCEM',         'CCEM',         'Christian education and curriculum ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'BEST',         'BEST',         'Business and entrepreneurship ministry.',  NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LEAD_TAKERS',  'LeadTakers',   'General leadership development ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LT_YOUTH',     'LT Youth',     'Youth leadership ministry.',               'Youth'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'LT_PROWORX',   'Lt ProWorx',   'Professional leadership ministry.',        'Young professionals'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'), 'D8_18',        'D8:18',        'Discipleship 8:18 ministry.',              NULL)

ON CONFLICT (code) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  network_id         = EXCLUDED.network_id,
  target_demographic = EXCLUDED.target_demographic;
```

### Verify after running `flyway migrate`

```sql
SELECT n.name, COUNT(m.ministry_id) AS count
FROM ministries.network n
LEFT JOIN ministries.ministry m ON m.network_id = n.network_id
GROUP BY n.name ORDER BY n.name;
-- Expected: Eagles=7, Wave=2, Wind=8

SELECT COUNT(*) FROM ministries.ministry_chapter;
-- Expected: 17
```

---

## Safety Rules

1. **Never commit `app/.env`** — contains prod Neon URL
2. **Never run Playwright against Neon** — always use local DB URL
3. **Never delete or edit existing V__ migrations** — Flyway will fail checksum validation
4. **Run `npx tsc --noEmit` before every commit** — must be zero errors
5. **Run `npx vitest run` before every commit** — 303 tests must pass
6. **Drizzle schema changes always need a corresponding migration** — never change `app/src/schema/*.ts` without a V__ migration
7. **Next migration number is V076** — do not reuse V075 or earlier numbers
