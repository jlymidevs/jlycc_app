# Ministries Seed Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all placeholder network/ministry seed data with the real JLYCC structure (Wind, Wave, Eagles — 17 ministries total).

**Architecture:** One versioned migration (V075) deletes all old data in safe order (ministry_chapter → ministry → network), then updated Flyway repeatable seeds (R__ files) re-insert the correct structure on next `flyway migrate`. No app-layer or Drizzle schema changes needed.

**Tech Stack:** PostgreSQL 16, Flyway SQL migrations, Docker Compose (local DB)

---

## Files

| File | Action |
|---|---|
| `db/migrations/V075__seed_overhaul_networks_ministries.sql` | Create |
| `db/migrations/R__seed_networks.sql` | Rewrite |
| `db/migrations/R__seed_networks_ministries.sql` | Rewrite |
| `db/migrations/R__seed_chapters.sql` | No change |

---

### Task 1: V075 — Delete all old network/ministry data

**Files:**
- Create: `db/migrations/V075__seed_overhaul_networks_ministries.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- db/migrations/V075__seed_overhaul_networks_ministries.sql
-- Delete old placeholder data in FK-safe order before re-seeding.
-- ministry_chapter.ministry_id and ministry.network_id have no CASCADE,
-- so we must delete in order: chapters → ministries → networks.

DELETE FROM ministries.ministry_chapter;
-- Cascades to: ministry_membership, join_request (both have ON DELETE CASCADE on chapter_id)

DELETE FROM ministries.ministry;
-- Safe: chapters already gone

DELETE FROM ministries.network;
-- Cascades to: network_leader (V073 added ON DELETE CASCADE on network_id)
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/V075__seed_overhaul_networks_ministries.sql
git commit -m "feat(db): V075 delete old network/ministry seed data"
```

---

### Task 2: Rewrite `R__seed_networks.sql`

**Files:**
- Modify: `db/migrations/R__seed_networks.sql`

- [ ] **Step 1: Replace the file content**

```sql
INSERT INTO ministries.network (code, name, description) VALUES
  ('WIND',   'Wind',   'Wind network — multimedia, worship arts, creative and outreach.'),
  ('WAVE',   'Wave',   'Wave network — sound and lighting production.'),
  ('EAGLES', 'Eagles', 'Eagles network — children, education, leadership and development.')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/R__seed_networks.sql
git commit -m "feat(db): seed Wind/Wave/Eagles networks"
```

---

### Task 3: Rewrite `R__seed_networks_ministries.sql`

**Files:**
- Modify: `db/migrations/R__seed_networks_ministries.sql`

- [ ] **Step 1: Replace the file content**

```sql
INSERT INTO ministries.ministry (network_id, code, name, description, target_demographic) VALUES

  -- Wind (8 ministries)
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'ZOOM_MULTIMEDIA',  'ZOOM - Multimedia',  'Multimedia and media production ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'DAVIDIC_SYNFONIA', 'Davidic Synfonia',   'Worship and music ministry.',               NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'MOVE',             'Move',               'Creative movement and dance ministry.',      NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'GATE_KEEPERS',     'Gate Keepers',       'Prayer and intercession ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'SENTINELS',        'Sentinels',          'Security and ushering ministry.',            NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'FRONTLINERS',      'Frontliners',        'Evangelism and outreach ministry.',          NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'CREATIVES',        'Creatives',          'Graphic design and creative arts ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WIND'),
    'PRISM',            'Prism',              'Visual arts and display ministry.',          NULL),

  -- Wave (2 ministries)
  ((SELECT network_id FROM ministries.network WHERE code = 'WAVE'),
    'SOUNDS',              'Sounds',              'Sound engineering and audio ministry.',  NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'WAVE'),
    'ILLUMINATION_LIGHTS', 'Illumination - Lights','Lighting and production ministry.',    NULL),

  -- Eagles (7 ministries)
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'KINGDOM_KIDS', 'Kingdom Kids', 'Children''s ministry.',                   'Children'),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'CCEM',         'CCEM',         'Christian education and curriculum ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'BEST',         'BEST',         'Business and entrepreneurship ministry.',  NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'LEAD_TAKERS',  'LeadTakers',   'General leadership development ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'LT_YOUTH',     'LT Youth',     'Youth leadership ministry.',               'Youth'),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'LT_PROWORX',   'Lt ProWorx',   'Professional leadership ministry.',        'Young professionals'),
  ((SELECT network_id FROM ministries.network WHERE code = 'EAGLES'),
    'D8_18',        'D8:18',        'Discipleship 8:18 ministry.',              NULL)

ON CONFLICT (code) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  network_id         = EXCLUDED.network_id,
  target_demographic = EXCLUDED.target_demographic;
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/R__seed_networks_ministries.sql
git commit -m "feat(db): seed 17 ministries across Wind/Wave/Eagles"
```

---

### Task 4: Verify locally with Flyway

**Files:** none

- [ ] **Step 1: Start local DB**

```bash
cd db
docker compose up -d postgres
```

Expected: postgres container running.

- [ ] **Step 2: Run Flyway migrate**

```bash
docker compose run --rm flyway migrate
```

Expected output includes:
```
Successfully applied 1 migration to schema "public" (V075)
Successfully applied 3 repeatable migrations (R__seed_networks, R__seed_networks_ministries, R__seed_chapters)
```

If Flyway complains about checksum mismatch on old R__ files, run `flyway repair` first:
```bash
docker compose run --rm flyway repair
docker compose run --rm flyway migrate
```

- [ ] **Step 3: Verify data**

```bash
docker compose exec postgres psql -U jly_admin -d jly -c "
SELECT n.name AS network, COUNT(m.ministry_id) AS ministry_count
FROM ministries.network n
LEFT JOIN ministries.ministry m ON m.network_id = n.network_id
GROUP BY n.name
ORDER BY n.name;
"
```

Expected:
```
 network | ministry_count
---------+----------------
 Eagles  |              7
 Wave    |              2
 Wind    |              8
```

- [ ] **Step 4: Verify chapters created**

```bash
docker compose exec postgres psql -U jly_admin -d jly -c "
SELECT COUNT(*) AS chapter_count FROM ministries.ministry_chapter;
"
```

Expected: `17` (one chapter per ministry at MAIN branch).

- [ ] **Step 5: Verify old data gone**

```bash
docker compose exec postgres psql -U jly_admin -d jly -c "
SELECT code FROM ministries.network ORDER BY code;
"
```

Expected:
```
   code
---------
 EAGLES
 WAVE
 WIND
```

- [ ] **Step 6: Push**

```bash
cd ..
git push
```

---

## Neon (prod) deployment

After verifying locally, run Flyway against Neon using the prod DATABASE_URL:

```bash
cd db
FLYWAY_URL=jdbc:postgresql://<neon-host>/jly FLYWAY_USER=<user> FLYWAY_PASSWORD=<pass> \
  docker compose run --rm flyway migrate
```

Or trigger via Vercel deploy pipeline if Flyway runs as part of deploy.
