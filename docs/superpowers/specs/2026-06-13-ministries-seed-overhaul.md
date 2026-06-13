# Ministries Seed Overhaul — Design Spec

**Date:** 2026-06-13
**Status:** Approved for implementation

---

## Overview

Replace the placeholder network and ministry seed data with the real JLYCC structure. Prod DB is fresh (no real ministry members), so old rows can be safely deleted before re-seeding.

---

## Target Structure

### Networks

| Code | Name |
|---|---|
| `WIND` | Wind |
| `WAVE` | Wave |
| `EAGLES` | Eagles |

`LEAD_TAKERS` network is removed entirely.

---

### Ministries

**Wind (8 ministries)**

| Code | Name |
|---|---|
| `ZOOM_MULTIMEDIA` | ZOOM - Multimedia |
| `DAVIDIC_SYNFONIA` | Davidic Synfonia |
| `MOVE` | Move |
| `GATE_KEEPERS` | Gate Keepers |
| `SENTINELS` | Sentinels |
| `FRONTLINERS` | Frontliners |
| `CREATIVES` | Creatives |
| `PRISM` | Prism |

**Wave (2 ministries)**

| Code | Name |
|---|---|
| `SOUNDS` | Sounds |
| `ILLUMINATION_LIGHTS` | Illumination - Lights |

**Eagles (7 ministries)**

| Code | Name |
|---|---|
| `KINGDOM_KIDS` | Kingdom Kids |
| `CCEM` | CCEM |
| `BEST` | BEST |
| `LEAD_TAKERS` | LeadTakers |
| `LT_YOUTH` | LT Youth |
| `LT_PROWORX` | Lt ProWorx |
| `D8_18` | D8:18 |

---

## Files Changed

| File | Action |
|---|---|
| `db/migrations/V075__seed_overhaul_networks_ministries.sql` | New — deletes all old networks + ministries |
| `db/migrations/R__seed_networks.sql` | Rewrite — Wind, Wave, Eagles |
| `db/migrations/R__seed_networks_ministries.sql` | Rewrite — 17 ministries across 3 networks |
| `db/migrations/R__seed_chapters.sql` | No change — already idempotent |

---

## Migration Strategy

### V075 (delete old data)

Must delete in order — no CASCADE on `ministry.network_id` or `ministry_chapter.ministry_id`:

```sql
DELETE FROM ministries.ministry_chapter;
-- cascades → ministry_membership, join_request

DELETE FROM ministries.ministry;

DELETE FROM ministries.network;
-- cascades → network_leader
```

Prod is fresh so no real member/event data references these rows.

### R__seed_networks.sql (rewrite)

Insert Wind, Wave, Eagles with `ON CONFLICT (code) DO UPDATE`.

### R__seed_networks_ministries.sql (rewrite)

Insert all 17 ministries with correct `network_id` lookups. Uses `ON CONFLICT (code) DO UPDATE`.

### R__seed_chapters.sql (unchanged)

Already creates one ACTIVE chapter per ministry at MAIN branch. Runs after ministries are seeded, so all 17 new ministries get a chapter automatically.

---

## Flyway Behavior

- V075 runs once (versioned) — clears old data
- R__ files re-run because their checksum changes — inserts new structure
- Net result: clean 3-network, 17-ministry structure on any DB that runs `flyway migrate`

---

## Notes

- No app-layer code changes needed — `getMinistries()` already queries dynamically
- No Drizzle schema changes needed
- `network_leader`, `ministry_membership` tables are unaffected (empty in prod)
