# Operational Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ministries`, `events`, and `attendance` schemas to the JLY Church Database, including ministry hierarchy, event management, partitioned check-in tracking, visitor intake, child safety check-in, and role-based PII grants.

**Architecture:** Three phases in dependency order — ministries (lookups + hierarchy), events (types + instances + registration), attendance (partitioned check-in + FTV capture + child safety). Each phase produces working, testable schema. Continues from Plan 1 foundation (V027, 119 tests).

**Tech Stack:** PostgreSQL 16, Flyway Community, pgTAP, Docker Compose, Git Bash on Windows.

---

## File Structure

### Migrations (V028–V042 + 3 repeatable)

| File | Responsibility |
|---|---|
| `V028__create_operational_schemas.sql` | CREATE SCHEMA ministries, events, attendance |
| `V029__ministries_network.sql` | network table + trigger |
| `V030__ministries_ministry.sql` | ministry table + trigger |
| `V031__ministries_chapter.sql` | ministry_chapter table + enums + trigger |
| `V032__ministries_membership.sql` | ministry_membership table + enum + CHECK |
| `V033__events_category_type.sql` | event_category + event_type + enums + trigger |
| `V034__events_series.sql` | event_series + enum + trigger |
| `V035__events_event.sql` | event table + enum + trigger |
| `V036__events_organizer.sql` | event_organizer table |
| `V037__events_registration.sql` | event_registration + enum + trigger |
| `V038__attendance_check_in.sql` | check_in (partitioned) + enum + 2 partitions |
| `V039__attendance_visitor_capture.sql` | visitor_capture + FK back-add on check_in |
| `V040__attendance_child_check_in.sql` | child_check_in extension |
| `V041__attendance_summary_view.sql` | attendance_summary view |
| `V042__plan2_roles_and_grants.sql` | attendance_writer role + PII grants for all 3 schemas |
| `R__seed_networks.sql` | 3 network rows |
| `R__seed_ministries.sql` | 9 ministry rows |
| `R__seed_event_types.sql` | 2 category + 15 event_type rows |

### Tests

| File | What it tests |
|---|---|
| `23_ministries_network_ministry.sql` | network + ministry tables, FKs, inserts |
| `24_ministries_chapter_membership.sql` | chapter + membership, leader CHECK, uniqueness |
| `25_ministries_seeds.sql` | seed data verification |
| `26_events_category_type.sql` | event_category + event_type, FK to ministries |
| `27_events_series_event.sql` | event_series + event, status enums |
| `28_events_organizer_registration.sql` | organizer composite PK, registration PII |
| `29_events_seeds.sql` | event type seed verification |
| `30_attendance_check_in.sql` | partitioned check_in, partition routing |
| `31_attendance_visitor_capture.sql` | visitor_capture + FK on check_in |
| `32_attendance_child_check_in.sql` | child_check_in 1:1, pickup_code uniqueness |
| `33_attendance_summary.sql` | summary view aggregation |
| `34_plan2_roles.sql` | attendance_writer + PII grant tests |

---

## Phase 1: `ministries`

### Task 1: Create schemas + `ministries.network` + `ministries.ministry`

**Files:**
- Create: `db/migrations/V028__create_operational_schemas.sql`
- Create: `db/migrations/V029__ministries_network.sql`
- Create: `db/migrations/V030__ministries_ministry.sql`
- Create: `db/tests/23_ministries_network_ministry.sql`

- [ ] **Step 1: Write `db/tests/23_ministries_network_ministry.sql`**

```sql
BEGIN;
SELECT plan(8);

SELECT has_schema('ministries', 'ministries schema exists');
SELECT has_table('ministries', 'network', 'network table exists');
SELECT has_table('ministries', 'ministry', 'ministry table exists');
SELECT col_is_unique('ministries', 'network', ARRAY['code'], 'network.code is unique');
SELECT col_is_unique('ministries', 'ministry', ARRAY['code'], 'ministry.code is unique');
SELECT has_fk('ministries', 'ministry', 'ministry has FK to network');

INSERT INTO ministries.network (code, name) VALUES ('TEST_NET', 'Test Network')
  RETURNING network_id \gset
INSERT INTO ministries.ministry (network_id, code, name)
  VALUES (:network_id, 'TEST_MIN', 'Test Ministry');
SELECT pass('network + ministry insert succeeds');

SELECT throws_ok(
  $$INSERT INTO ministries.ministry (network_id, code, name) VALUES (999999, 'X', 'X')$$,
  '23503', NULL, 'invalid network_id rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

```bash
cd db && docker compose run --rm flyway migrate && export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && docker compose exec -T postgres psql -U jly_admin -d jly -f /tests/23_ministries_network_ministry.sql
```

Expected: FAIL (schema/tables don't exist yet)

- [ ] **Step 3: Write `db/migrations/V028__create_operational_schemas.sql`**

```sql
CREATE SCHEMA IF NOT EXISTS ministries;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS attendance;

COMMENT ON SCHEMA ministries IS 'Ministry hierarchy: Network → Ministry → Branch Chapter → Membership.';
COMMENT ON SCHEMA events IS 'Event management: types, series, instances, organizers, registration.';
COMMENT ON SCHEMA attendance IS 'Check-in tracking, FTV intake, child safety. check_in is partitioned by month.';
```

- [ ] **Step 4: Write `db/migrations/V029__ministries_network.sql`**

```sql
CREATE TABLE ministries.network (
  network_id   BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  founded_on   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_network_updated_at
  BEFORE UPDATE ON ministries.network
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.network IS 'Top-level ministry grouping (Eagles, Wind, Lead Takers).';
```

- [ ] **Step 5: Write `db/migrations/V030__ministries_ministry.sql`**

```sql
CREATE TABLE ministries.ministry (
  ministry_id        BIGSERIAL PRIMARY KEY,
  network_id         BIGINT NOT NULL REFERENCES ministries.network(network_id),
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  target_demographic TEXT,
  founded_on         DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ministry_network ON ministries.ministry(network_id);

CREATE TRIGGER trg_ministry_updated_at
  BEFORE UPDATE ON ministries.ministry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.ministry IS 'A ministry (Move, CCEM, LT Pro, etc.) under a network.';
```

- [ ] **Step 6: Apply and re-run tests**

```bash
cd db && docker compose run --rm flyway migrate && export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && docker compose exec -T postgres psql -U jly_admin -d jly -f /tests/23_ministries_network_ministry.sql
```

Expected: 8/8 pass

- [ ] **Step 7: Commit**

```bash
git add db/migrations/V028__create_operational_schemas.sql \
        db/migrations/V029__ministries_network.sql \
        db/migrations/V030__ministries_ministry.sql \
        db/tests/23_ministries_network_ministry.sql
git commit -m "feat(db): add ministries schema with network and ministry tables"
```

---

### Task 2: `ministries.ministry_chapter` + `ministries.ministry_membership`

**Files:**
- Create: `db/migrations/V031__ministries_chapter.sql`
- Create: `db/migrations/V032__ministries_membership.sql`
- Create: `db/tests/24_ministries_chapter_membership.sql`

- [ ] **Step 1: Write `db/tests/24_ministries_chapter_membership.sql`**

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('ministries', 'ministry_chapter', 'chapter table exists');
SELECT has_table('ministries', 'ministry_membership', 'membership table exists');

INSERT INTO ministries.network (code, name) VALUES ('N', 'N') RETURNING network_id \gset
INSERT INTO ministries.ministry (network_id, code, name) VALUES (:network_id, 'M', 'M') RETURNING ministry_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES (:ministry_id, :branch_id) RETURNING chapter_id \gset
SELECT pass('chapter insert succeeds');

-- Duplicate (ministry, branch) should fail
PREPARE dup_chapter AS
  INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES (:ministry_id, :branch_id);
SELECT throws_ok('dup_chapter', '23505', NULL, 'duplicate (ministry, branch) rejected');

-- Ministry membership with leadership
INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
  VALUES (:chapter_id, :member_id, now(), true, 'HEAD');
SELECT pass('leader membership insert succeeds');

-- CHECK: is_leader=true requires leader_role
SELECT throws_ok(
  format($$INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
    VALUES (%L, %L, now(), true, NULL)$$, :chapter_id, :member_id),
  '23514', NULL, 'leader without role rejected by CHECK'
);

-- CHECK: is_leader=false requires leader_role IS NULL
SELECT throws_ok(
  format($$INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
    VALUES (%L, %L, now(), false, 'HEAD')$$, :chapter_id, :member_id),
  '23514', NULL, 'non-leader with role rejected by CHECK'
);

SELECT throws_ok(
  $$INSERT INTO ministries.ministry_chapter (ministry_id, branch_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid chapter_status rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V031__ministries_chapter.sql`**

```sql
CREATE TYPE ministries.chapter_status AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

CREATE TABLE ministries.ministry_chapter (
  chapter_id   BIGSERIAL PRIMARY KEY,
  ministry_id  BIGINT NOT NULL REFERENCES ministries.ministry(ministry_id),
  branch_id    BIGINT NOT NULL REFERENCES core.branch(branch_id),
  launched_on  DATE,
  status       ministries.chapter_status NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapter_ministry_branch_unique UNIQUE (ministry_id, branch_id)
);

CREATE INDEX idx_chapter_branch ON ministries.ministry_chapter(branch_id);
CREATE INDEX idx_chapter_status ON ministries.ministry_chapter(status);

CREATE TRIGGER trg_chapter_updated_at
  BEFORE UPDATE ON ministries.ministry_chapter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE ministries.ministry_chapter IS 'Per-branch instance of a ministry. UNIQUE(ministry_id, branch_id).';
```

- [ ] **Step 4: Write `db/migrations/V032__ministries_membership.sql`**

```sql
CREATE TYPE ministries.leader_role AS ENUM ('HEAD', 'ASSISTANT_HEAD', 'COORDINATOR');

CREATE TABLE ministries.ministry_membership (
  membership_id     BIGSERIAL PRIMARY KEY,
  chapter_id        BIGINT NOT NULL REFERENCES ministries.ministry_chapter(chapter_id) ON DELETE CASCADE,
  member_id         BIGINT NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  ended_reason      TEXT,
  is_leader         BOOLEAN NOT NULL DEFAULT false,
  leader_role       ministries.leader_role,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_membership_leader_check
    CHECK ((is_leader = false AND leader_role IS NULL) OR (is_leader = true AND leader_role IS NOT NULL))
);

CREATE INDEX idx_ministry_membership_chapter ON ministries.ministry_membership(chapter_id);
CREATE INDEX idx_ministry_membership_member ON ministries.ministry_membership(member_id);
CREATE INDEX idx_ministry_membership_active
  ON ministries.ministry_membership(chapter_id) WHERE ended_at IS NULL;

COMMENT ON TABLE ministries.ministry_membership IS 'Member ↔ chapter with optional leadership role. Append-only; close by setting ended_at.';
```

- [ ] **Step 5: Apply and re-run tests**

```bash
cd db && docker compose run --rm flyway migrate && ./tests/run_tests.sh
```

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V031__ministries_chapter.sql \
        db/migrations/V032__ministries_membership.sql \
        db/tests/24_ministries_chapter_membership.sql
git commit -m "feat(db): add ministry_chapter and ministry_membership with leader CHECK"
```

---

### Task 3: Seed networks and ministries

**Files:**
- Create: `db/migrations/R__seed_networks.sql`
- Create: `db/migrations/R__seed_ministries.sql`
- Create: `db/tests/25_ministries_seeds.sql`

- [ ] **Step 1: Write `db/tests/25_ministries_seeds.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT bag_eq(
  $$SELECT code FROM ministries.network ORDER BY code$$,
  $$VALUES ('EAGLES'),('LEAD_TAKERS'),('WIND')$$,
  'all 3 networks seeded'
);

SELECT bag_has(
  $$SELECT code FROM ministries.ministry$$,
  $$VALUES ('MOVE'),('CCEM'),('HARPS_AND_BOWLS'),('KINGDOM_KIDS'),
           ('COUPLES'),('MISSIONS'),
           ('LT_CONNECT'),('LT_YOUTH'),('LT_PRO')$$,
  'all 9 ministries seeded'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'MOVE'),
  'EAGLES',
  'Move belongs to Eagles network'
);

SELECT is(
  (SELECT n.code FROM ministries.ministry m
   JOIN ministries.network n ON n.network_id = m.network_id
   WHERE m.code = 'LT_PRO'),
  'LEAD_TAKERS',
  'LT Pro belongs to Lead Takers network'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure** (seeds not yet applied)

- [ ] **Step 3: Write `db/migrations/R__seed_networks.sql`**

```sql
INSERT INTO ministries.network (code, name, description) VALUES
  ('EAGLES',       'Eagles',       'Eagles network — worship, creative arts, children.'),
  ('WIND',         'Wind',         'Wind network — couples, missions.'),
  ('LEAD_TAKERS',  'Lead Takers',  'Lead Takers network — leadership development.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
```

- [ ] **Step 4: Write `db/migrations/R__seed_ministries.sql`**

```sql
INSERT INTO ministries.ministry (network_id, code, name, description, target_demographic) VALUES
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'MOVE', 'Move', 'Creative movement and dance ministry.', 'Young adults'),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'CCEM', 'CCEM', 'Creative and communications ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'HARPS_AND_BOWLS', 'Harps and Bowls', 'Worship and intercession ministry.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    'KINGDOM_KIDS', 'Kingdom Kids', 'Children''s ministry.', 'Children'),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'),
    'COUPLES', 'Couples Ministry', 'Ministry for married couples.', 'Married couples'),
  ((SELECT network_id FROM ministries.network WHERE code='WIND'),
    'MISSIONS', 'Missions', 'Local and international missions.', NULL),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_CONNECT', 'LT Connect', 'Leadership connection groups.', 'Leaders'),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_YOUTH', 'LT Youth', 'Youth leadership development.', 'Youth'),
  ((SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    'LT_PRO', 'LT Pro', 'Professional leadership development.', 'Young professionals')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  network_id = EXCLUDED.network_id,
  target_demographic = EXCLUDED.target_demographic;
```

- [ ] **Step 5: Apply and re-run tests**

```bash
cd db && docker compose run --rm flyway migrate && ./tests/run_tests.sh
```

- [ ] **Step 6: Commit**

```bash
git add db/migrations/R__seed_networks.sql \
        db/migrations/R__seed_ministries.sql \
        db/tests/25_ministries_seeds.sql
git commit -m "feat(db): seed networks (3) and ministries (9) with ON CONFLICT upsert"
```

---

## Phase 2: `events`

### Task 4: `events.event_category` + `events.event_type`

**Files:**
- Create: `db/migrations/V033__events_category_type.sql`
- Create: `db/tests/26_events_category_type.sql`

- [ ] **Step 1: Write `db/tests/26_events_category_type.sql`**

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_category', 'event_category exists');
SELECT has_table('events', 'event_type', 'event_type exists');
SELECT col_is_pk('events', 'event_category', 'category_code', 'category_code is PK');
SELECT col_is_unique('events', 'event_type', ARRAY['code'], 'event_type.code is unique');
SELECT has_fk('events', 'event_type', 'event_type has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('TEST_CAT', 'Test');
INSERT INTO events.event_type (code, name, category_code, typical_duration_minutes)
  VALUES ('TEST_EVT', 'Test Event', 'TEST_CAT', 60);
SELECT pass('category + type insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event_type (code, name, category_code) VALUES ('X', 'X', 'NONEXISTENT')$$,
  '23503', NULL, 'invalid category_code rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V033__events_category_type.sql`**

```sql
CREATE TABLE events.event_category (
  category_code TEXT PRIMARY KEY,
  name          TEXT NOT NULL
);

COMMENT ON TABLE events.event_category IS 'Event categories: SEASONAL (one-off) or REGULAR (recurring).';

CREATE TABLE events.event_type (
  event_type_id          BIGSERIAL PRIMARY KEY,
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  category_code          TEXT NOT NULL REFERENCES events.event_category(category_code),
  network_id             BIGINT REFERENCES ministries.network(network_id),
  ministry_id            BIGINT REFERENCES ministries.ministry(ministry_id),
  typical_duration_minutes INT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_type_category ON events.event_type(category_code);

CREATE TRIGGER trg_event_type_updated_at
  BEFORE UPDATE ON events.event_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event_type IS 'Lookup of event types. network_id/ministry_id link to owning ministry when applicable.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V033__events_category_type.sql \
        db/tests/26_events_category_type.sql
git commit -m "feat(db): add events.event_category and events.event_type"
```

---

### Task 5: `events.event_series` + `events.event`

**Files:**
- Create: `db/migrations/V034__events_series.sql`
- Create: `db/migrations/V035__events_event.sql`
- Create: `db/tests/27_events_series_event.sql`

- [ ] **Step 1: Write `db/tests/27_events_series_event.sql`**

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_series', 'event_series exists');
SELECT has_table('events', 'event', 'event exists');
SELECT has_fk('events', 'event', 'event has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  RETURNING event_type_id \gset

INSERT INTO events.event_series (event_type_id, name, recurrence_pattern, starts_on)
  VALUES (:event_type_id, 'Weekly Service', 'WEEKLY', CURRENT_DATE)
  RETURNING series_id \gset
SELECT pass('series insert succeeds');

INSERT INTO events.event (event_type_id, series_id, name, starts_at, status)
  VALUES (:event_type_id, :series_id, 'Sunday Service Apr 20', now(), 'SCHEDULED');
SELECT pass('event insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event (event_type_id, name, starts_at, status)
    VALUES (1, 'X', now(), 'BOGUS')$$,
  '22P02', NULL, 'invalid event_status rejected'
);

SELECT throws_ok(
  $$INSERT INTO events.event_series (event_type_id, name, recurrence_pattern, starts_on)
    VALUES (1, 'X', 'BOGUS', CURRENT_DATE)$$,
  '22P02', NULL, 'invalid recurrence_pattern rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V034__events_series.sql`**

```sql
CREATE TYPE events.recurrence_pattern AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE events.series_status AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

CREATE TABLE events.event_series (
  series_id          BIGSERIAL PRIMARY KEY,
  event_type_id      BIGINT NOT NULL REFERENCES events.event_type(event_type_id),
  branch_id          BIGINT REFERENCES core.branch(branch_id),
  name               TEXT NOT NULL,
  recurrence_pattern events.recurrence_pattern NOT NULL,
  recurrence_config  JSONB NOT NULL DEFAULT '{}',
  starts_on          DATE NOT NULL,
  ends_on            DATE,
  status             events.series_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_series_event_type ON events.event_series(event_type_id);
CREATE INDEX idx_series_branch ON events.event_series(branch_id);

CREATE TRIGGER trg_series_updated_at
  BEFORE UPDATE ON events.event_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event_series IS 'Recurring event schedule. recurrence_config JSONB is app-interpreted.';
```

- [ ] **Step 4: Write `db/migrations/V035__events_event.sql`**

```sql
CREATE TYPE events.event_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE events.event (
  event_id        BIGSERIAL PRIMARY KEY,
  event_type_id   BIGINT NOT NULL REFERENCES events.event_type(event_type_id),
  series_id       BIGINT REFERENCES events.event_series(series_id),
  branch_id       BIGINT REFERENCES core.branch(branch_id),
  host_branch_id  BIGINT REFERENCES core.branch(branch_id),
  name            TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  venue           TEXT,
  expected_attendance INT,
  status          events.event_status NOT NULL DEFAULT 'SCHEDULED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_type ON events.event(event_type_id);
CREATE INDEX idx_event_series ON events.event(series_id);
CREATE INDEX idx_event_branch ON events.event(branch_id);
CREATE INDEX idx_event_starts_at ON events.event(starts_at DESC);
CREATE INDEX idx_event_status ON events.event(status);

CREATE TRIGGER trg_event_updated_at
  BEFORE UPDATE ON events.event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE events.event IS 'Concrete event instance. branch_id = owning branch; host_branch_id = physical venue branch.';
```

- [ ] **Step 5: Apply and re-run tests**

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V034__events_series.sql \
        db/migrations/V035__events_event.sql \
        db/tests/27_events_series_event.sql
git commit -m "feat(db): add event_series and event with status/recurrence enums"
```

---

### Task 6: `events.event_organizer` + `events.event_registration`

**Files:**
- Create: `db/migrations/V036__events_organizer.sql`
- Create: `db/migrations/V037__events_registration.sql`
- Create: `db/tests/28_events_organizer_registration.sql`

- [ ] **Step 1: Write `db/tests/28_events_organizer_registration.sql`**

```sql
BEGIN;
SELECT plan(7);

SELECT has_table('events', 'event_organizer', 'organizer table exists');
SELECT has_table('events', 'event_registration', 'registration table exists');

INSERT INTO events.event_category (category_code, name) VALUES ('SEASONAL', 'Seasonal');
INSERT INTO events.event_type (code, name, category_code) VALUES ('CM', 'Camp Meeting', 'SEASONAL')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Camp Meeting 2026', now()) RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset
INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
  VALUES (:person_id, :branch_id, 'B-1', 'REGULAR_MEMBER', now()) RETURNING member_id \gset

-- Organizer with composite PK
INSERT INTO events.event_organizer (event_id, member_id, role)
  VALUES (:event_id, :member_id, 'Lead Coordinator');
SELECT pass('organizer insert succeeds');

-- Duplicate organizer should fail
PREPARE dup_org AS
  INSERT INTO events.event_organizer (event_id, member_id, role)
  VALUES (:event_id, :member_id, 'Another Role');
SELECT throws_ok('dup_org', '23505', NULL, 'duplicate (event, member) organizer rejected');

-- Registration (uses person_id, not member_id)
INSERT INTO events.event_registration (event_id, person_id, status, group_size)
  VALUES (:event_id, :person_id, 'REGISTERED', 2);
SELECT pass('registration insert succeeds');

SELECT throws_ok(
  $$INSERT INTO events.event_registration (event_id, person_id, status)
    VALUES (1, 1, 'BOGUS')$$,
  '22P02', NULL, 'invalid registration_status rejected'
);

SELECT col_not_null('events', 'event_registration', 'event_id', 'event_id NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V036__events_organizer.sql`**

```sql
CREATE TABLE events.event_organizer (
  event_id   BIGINT NOT NULL REFERENCES events.event(event_id) ON DELETE CASCADE,
  member_id  BIGINT NOT NULL REFERENCES membership.member(member_id),
  role       TEXT NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);

CREATE INDEX idx_organizer_member ON events.event_organizer(member_id);

COMMENT ON TABLE events.event_organizer IS 'Event organizer assignment. Composite PK (event_id, member_id).';
```

- [ ] **Step 4: Write `db/migrations/V037__events_registration.sql`**

```sql
CREATE TYPE events.registration_status AS ENUM (
  'REGISTERED', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW'
);

CREATE TABLE events.event_registration (
  registration_id        BIGSERIAL PRIMARY KEY,
  event_id               BIGINT NOT NULL REFERENCES events.event(event_id),
  person_id              BIGINT NOT NULL REFERENCES core.person(person_id),
  registered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_by_member_id BIGINT REFERENCES membership.member(member_id),
  status                 events.registration_status NOT NULL DEFAULT 'REGISTERED',
  accommodation_required BOOLEAN NOT NULL DEFAULT false,
  dietary_requirements   TEXT,
  group_size             INT NOT NULL DEFAULT 1,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  payment_reference      TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_registration_event ON events.event_registration(event_id);
CREATE INDEX idx_registration_person ON events.event_registration(person_id);
CREATE INDEX idx_registration_status ON events.event_registration(event_id, status);

CREATE TRIGGER trg_registration_updated_at
  BEFORE UPDATE ON events.event_registration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN events.event_registration.emergency_contact_name IS 'PII';
COMMENT ON COLUMN events.event_registration.emergency_contact_phone IS 'PII';
COMMENT ON COLUMN events.event_registration.dietary_requirements IS 'PII';
COMMENT ON TABLE events.event_registration IS 'Event registration/RSVP. Uses person_id so non-members can register. PII: emergency contact, dietary info.';
```

- [ ] **Step 5: Apply and re-run tests**

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V036__events_organizer.sql \
        db/migrations/V037__events_registration.sql \
        db/tests/28_events_organizer_registration.sql
git commit -m "feat(db): add event_organizer (composite PK) and event_registration (PII)"
```

---

### Task 7: Seed event types

**Files:**
- Create: `db/migrations/R__seed_event_types.sql`
- Create: `db/tests/29_events_seeds.sql`

- [ ] **Step 1: Write `db/tests/29_events_seeds.sql`**

```sql
BEGIN;
SELECT plan(4);

SELECT bag_eq(
  $$SELECT category_code FROM events.event_category ORDER BY category_code$$,
  $$VALUES ('REGULAR'),('SEASONAL')$$,
  'both event categories seeded'
);

SELECT is(
  (SELECT count(*)::int FROM events.event_type),
  15,
  '15 event types seeded'
);

SELECT is(
  (SELECT n.code FROM events.event_type et
   JOIN ministries.network n ON n.network_id = et.network_id
   WHERE et.code = 'LT_CONNECT'),
  'LEAD_TAKERS',
  'LT_CONNECT linked to Lead Takers network'
);

SELECT is(
  (SELECT m.code FROM events.event_type et
   JOIN ministries.ministry m ON m.ministry_id = et.ministry_id
   WHERE et.code = 'KINGDOM_KIDS'),
  'KINGDOM_KIDS',
  'KINGDOM_KIDS event type linked to Kingdom Kids ministry'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/R__seed_event_types.sql`**

```sql
INSERT INTO events.event_category (category_code, name) VALUES
  ('SEASONAL', 'Seasonal'),
  ('REGULAR',  'Regular')
ON CONFLICT (category_code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO events.event_type (code, name, category_code, network_id, ministry_id, typical_duration_minutes) VALUES
  ('SUNDAY_SERVICE',  'Sunday Service',             'REGULAR',  NULL, NULL, 120),
  ('FRIDAY_PRAYER',   'Friday Prayer Meeting',      'REGULAR',  NULL, NULL, 90),
  ('GNY',             'Grand New Year',             'SEASONAL', NULL, NULL, 180),
  ('CAMP_MEETING',    'Camp Meeting',               'SEASONAL', NULL, NULL, NULL),
  ('APC',             'Annual Pastors Conference',  'SEASONAL', NULL, NULL, NULL),
  ('MID_YEAR_PC',     'Mid-Year Pastors Conference','SEASONAL', NULL, NULL, NULL),
  ('ANNIVERSARY',     'Church Anniversary',         'SEASONAL', NULL, NULL, 180),
  ('CHRISTMAS',       'Christmas Celebration',      'SEASONAL', NULL, NULL, 180),
  ('COUPLES',         'Couples Event',              'SEASONAL',
    (SELECT network_id FROM ministries.network WHERE code='WIND'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='COUPLES'), 120),
  ('MISSIONS_MONTH',  'Missions Month',             'SEASONAL',
    (SELECT network_id FROM ministries.network WHERE code='WIND'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='MISSIONS'), NULL),
  ('LT_CONNECT',      'LT Connect',                'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LT_CONNECT'), 90),
  ('KINGDOM_KIDS',    'Kingdom Kids',               'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='KINGDOM_KIDS'), 90),
  ('LT_YOUTH',        'LT Youth',                  'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LT_YOUTH'), 90),
  ('LT_PRO',          'LT Pro',                    'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='LEAD_TAKERS'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='LT_PRO'), 90),
  ('HARPS_AND_BOWLS', 'Harps and Bowls',            'REGULAR',
    (SELECT network_id FROM ministries.network WHERE code='EAGLES'),
    (SELECT ministry_id FROM ministries.ministry WHERE code='HARPS_AND_BOWLS'), 90)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category_code = EXCLUDED.category_code,
  network_id = EXCLUDED.network_id,
  ministry_id = EXCLUDED.ministry_id,
  typical_duration_minutes = EXCLUDED.typical_duration_minutes;
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/R__seed_event_types.sql \
        db/tests/29_events_seeds.sql
git commit -m "feat(db): seed event categories (2) and event types (15)"
```

---

## Phase 3: `attendance`

### Task 8: `attendance.check_in` (partitioned)

**Files:**
- Create: `db/migrations/V038__attendance_check_in.sql`
- Create: `db/tests/30_attendance_check_in.sql`

- [ ] **Step 1: Write `db/tests/30_attendance_check_in.sql`**

```sql
BEGIN;
SELECT plan(6);

SELECT has_table('attendance', 'check_in', 'check_in table exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Sunday Apr 20', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id \gset

-- Insert into April 2026 partition
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:event_id, :person_id, :branch_id, '2026-04-20 09:15:00+08', 'USHER');
SELECT pass('check_in insert routes to April partition');

-- Verify row lands in correct partition
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in_2026_04),
  1,
  'row exists in check_in_2026_04 partition'
);

-- Insert into May 2026 partition
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :person_id, :branch_id, '2026-05-04 09:15:00+08');
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in_2026_05),
  1,
  'row exists in check_in_2026_05 partition'
);

SELECT throws_ok(
  $$INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
    VALUES (1, 1, 1, '2026-04-20 09:00:00+08', 'BOGUS')$$,
  '22P02', NULL, 'invalid check_in_method rejected'
);

-- Total via parent
SELECT is(
  (SELECT count(*)::int FROM attendance.check_in),
  2,
  'parent table sees both partitions'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V038__attendance_check_in.sql`**

```sql
CREATE TYPE attendance.check_in_method AS ENUM ('SELF', 'USHER', 'BULK_IMPORT');

CREATE TABLE attendance.check_in (
  check_in_id          BIGSERIAL,
  event_id             BIGINT NOT NULL,
  person_id            BIGINT NOT NULL,
  branch_id            BIGINT NOT NULL,
  checked_in_at        TIMESTAMPTZ NOT NULL,
  check_in_method      attendance.check_in_method NOT NULL DEFAULT 'USHER',
  captured_by_member_id BIGINT,
  ftv_capture_id       BIGINT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (check_in_id, checked_in_at)
) PARTITION BY RANGE (checked_in_at);

-- FKs on partitioned tables (PG16 supports this)
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_event_fk FOREIGN KEY (event_id) REFERENCES events.event(event_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_person_fk FOREIGN KEY (person_id) REFERENCES core.person(person_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_branch_fk FOREIGN KEY (branch_id) REFERENCES core.branch(branch_id);
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_captured_by_fk FOREIGN KEY (captured_by_member_id) REFERENCES membership.member(member_id);

CREATE INDEX idx_check_in_event ON attendance.check_in(event_id);
CREATE INDEX idx_check_in_person ON attendance.check_in(person_id, checked_in_at DESC);
CREATE INDEX idx_check_in_branch ON attendance.check_in(branch_id, checked_in_at DESC);

-- Initial partitions: April 2026 + May 2026
CREATE TABLE attendance.check_in_2026_04 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE attendance.check_in_2026_05 PARTITION OF attendance.check_in
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

COMMENT ON TABLE attendance.check_in IS 'Per-person check-in. Partitioned by month on checked_in_at. Uses person_id (not member_id) so FTVs work.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V038__attendance_check_in.sql \
        db/tests/30_attendance_check_in.sql
git commit -m "feat(db): add partitioned attendance.check_in with April/May 2026 partitions"
```

---

### Task 9: `attendance.visitor_capture` + FK back-add on `check_in`

**Files:**
- Create: `db/migrations/V039__attendance_visitor_capture.sql`
- Create: `db/tests/31_attendance_visitor_capture.sql`

- [ ] **Step 1: Write `db/tests/31_attendance_visitor_capture.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('attendance', 'visitor_capture', 'visitor_capture exists');
SELECT has_fk('attendance', 'visitor_capture', 'visitor_capture has FK');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Service', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('FTV', 'Person') RETURNING person_id \gset

INSERT INTO attendance.visitor_capture (person_id, event_id, branch_id, consent_to_contact, intake_notes)
  VALUES (:person_id, :event_id, :branch_id, true, 'Invited by friend')
  RETURNING ftv_capture_id \gset
SELECT pass('visitor_capture insert succeeds');

-- check_in with ftv_capture_id FK
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
  VALUES (:event_id, :person_id, :branch_id, '2026-04-20 09:15:00+08', :ftv_capture_id);
SELECT pass('check_in with ftv_capture_id succeeds');

-- Invalid ftv_capture_id should fail
SELECT throws_ok(
  format($$INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
    VALUES (%L, %L, %L, '2026-04-20 09:30:00+08', 999999)$$, :event_id, :person_id, :branch_id),
  '23503', NULL, 'invalid ftv_capture_id rejected via FK'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V039__attendance_visitor_capture.sql`**

```sql
CREATE TABLE attendance.visitor_capture (
  ftv_capture_id        BIGSERIAL PRIMARY KEY,
  person_id             BIGINT NOT NULL REFERENCES core.person(person_id),
  event_id              BIGINT NOT NULL REFERENCES events.event(event_id),
  branch_id             BIGINT NOT NULL REFERENCES core.branch(branch_id),
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by_member_id BIGINT REFERENCES membership.member(member_id),
  invited_by_person_id  BIGINT REFERENCES core.person(person_id),
  consent_to_contact    BOOLEAN NOT NULL DEFAULT false,
  intake_notes          TEXT,
  converted_member_id   BIGINT REFERENCES membership.member(member_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitor_capture_person ON attendance.visitor_capture(person_id);
CREATE INDEX idx_visitor_capture_event ON attendance.visitor_capture(event_id);
CREATE INDEX idx_visitor_capture_branch ON attendance.visitor_capture(branch_id);

COMMENT ON COLUMN attendance.visitor_capture.intake_notes IS 'PII';
COMMENT ON TABLE attendance.visitor_capture IS 'FTV intake form. Links a new person to the event where they were first captured. PII: intake_notes.';

-- Add FK on check_in.ftv_capture_id now that visitor_capture exists
ALTER TABLE attendance.check_in
  ADD CONSTRAINT check_in_ftv_capture_fk
  FOREIGN KEY (ftv_capture_id) REFERENCES attendance.visitor_capture(ftv_capture_id);
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V039__attendance_visitor_capture.sql \
        db/tests/31_attendance_visitor_capture.sql
git commit -m "feat(db): add visitor_capture (FTV intake) and FK back-add on check_in"
```

---

### Task 10: `attendance.child_check_in`

**Files:**
- Create: `db/migrations/V040__attendance_child_check_in.sql`
- Create: `db/tests/32_attendance_child_check_in.sql`

- [ ] **Step 1: Write `db/tests/32_attendance_child_check_in.sql`**

```sql
BEGIN;
SELECT plan(5);

SELECT has_table('attendance', 'child_check_in', 'child_check_in exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('KK', 'Kids', 'REGULAR')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Kingdom Kids Apr 20', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Parent', 'X') RETURNING person_id AS parent_pid \gset
INSERT INTO core.person (first_name, last_name) VALUES ('Child', 'X') RETURNING person_id AS child_pid \gset

-- Parent check-in
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :parent_pid, :branch_id, '2026-04-20 09:00:00+08')
  RETURNING check_in_id AS parent_ci_id, checked_in_at AS parent_ci_at \gset

-- Child check-in
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :child_pid, :branch_id, '2026-04-20 09:00:00+08')
  RETURNING check_in_id AS child_ci_id, checked_in_at AS child_ci_at \gset

INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, parent_check_in_id, parent_checked_in_at, pickup_code, allergies)
  VALUES (:child_ci_id, :child_ci_at, :event_id, :parent_ci_id, :parent_ci_at, 'MNL-K-0001', 'Peanuts');
SELECT pass('child_check_in insert succeeds');

-- Duplicate pickup_code for same event should fail
INSERT INTO core.person (first_name, last_name) VALUES ('Child2', 'X') RETURNING person_id AS child2_pid \gset
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :child2_pid, :branch_id, '2026-04-20 09:05:00+08')
  RETURNING check_in_id AS child2_ci_id, checked_in_at AS child2_ci_at \gset

PREPARE dup_code AS
  INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, parent_check_in_id, parent_checked_in_at, pickup_code)
  VALUES (:child2_ci_id, :child2_ci_at, :event_id, :parent_ci_id, :parent_ci_at, 'MNL-K-0001');
SELECT throws_ok('dup_code', '23505', NULL, 'duplicate pickup_code per event rejected');

-- Different event, same pickup_code should succeed
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Kingdom Kids Apr 27', '2026-04-27 09:00:00+08') RETURNING event_id AS event2_id \gset
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event2_id, :child2_pid, :branch_id, '2026-04-27 09:00:00+08')
  RETURNING check_in_id AS child3_ci_id, checked_in_at AS child3_ci_at \gset
INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, parent_check_in_id, parent_checked_in_at, pickup_code)
  VALUES (:child3_ci_id, :child3_ci_at, :event2_id, NULL, NULL, 'MNL-K-0001');
SELECT pass('same pickup_code allowed for different event');

SELECT col_not_null('attendance', 'child_check_in', 'pickup_code', 'pickup_code NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V040__attendance_child_check_in.sql`**

```sql
CREATE TABLE attendance.child_check_in (
  check_in_id                BIGINT NOT NULL,
  checked_in_at              TIMESTAMPTZ NOT NULL,
  event_id                   BIGINT NOT NULL,
  parent_check_in_id         BIGINT,
  parent_checked_in_at       TIMESTAMPTZ,
  pickup_code                TEXT NOT NULL,
  allergies                  TEXT,
  picked_up_at               TIMESTAMPTZ,
  picked_up_by_person_id     BIGINT REFERENCES core.person(person_id),
  pickup_verified_by_member_id BIGINT REFERENCES membership.member(member_id),
  PRIMARY KEY (check_in_id, checked_in_at),
  CONSTRAINT child_check_in_fk
    FOREIGN KEY (check_in_id, checked_in_at)
    REFERENCES attendance.check_in(check_in_id, checked_in_at),
  CONSTRAINT child_check_in_parent_fk
    FOREIGN KEY (parent_check_in_id, parent_checked_in_at)
    REFERENCES attendance.check_in(check_in_id, checked_in_at),
  CONSTRAINT child_check_in_pickup_unique UNIQUE (event_id, pickup_code)
);

CREATE INDEX idx_child_check_in_parent ON attendance.child_check_in(parent_check_in_id);

COMMENT ON COLUMN attendance.child_check_in.allergies IS 'PII';
COMMENT ON TABLE attendance.child_check_in IS 'Child check-in extension. 1:1 with check_in. Pickup code unique per event for child safety.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V040__attendance_child_check_in.sql \
        db/tests/32_attendance_child_check_in.sql
git commit -m "feat(db): add child_check_in with pickup_code uniqueness per event"
```

---

### Task 11: `attendance.attendance_summary` view

**Files:**
- Create: `db/migrations/V041__attendance_summary_view.sql`
- Create: `db/tests/33_attendance_summary.sql`

- [ ] **Step 1: Write `db/tests/33_attendance_summary.sql`**

```sql
BEGIN;
SELECT plan(3);

SELECT has_view('attendance', 'attendance_summary', 'summary view exists');

INSERT INTO events.event_category (category_code, name) VALUES ('REGULAR', 'Regular');
INSERT INTO events.event_type (code, name, category_code) VALUES ('SVC', 'Service', 'REGULAR')
  RETURNING event_type_id \gset
INSERT INTO events.event (event_type_id, name, starts_at)
  VALUES (:event_type_id, 'Sunday', '2026-04-20 09:00:00+08') RETURNING event_id \gset
INSERT INTO core.region (code, name, type) VALUES ('R', 'R', 'LOCAL_CLUSTER') RETURNING region_id \gset
INSERT INTO core.branch (code, name, region_id, type, country_code, timezone)
  VALUES ('B', 'B', :region_id, 'LOCAL', 'PH', 'Asia/Manila') RETURNING branch_id \gset
INSERT INTO core.person (first_name, last_name) VALUES ('A', 'X') RETURNING person_id AS p1 \gset
INSERT INTO core.person (first_name, last_name) VALUES ('B', 'Y') RETURNING person_id AS p2 \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :p1, :branch_id, '2026-04-20 09:10:00+08');
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:event_id, :p2, :branch_id, '2026-04-20 09:12:00+08');

SELECT is(
  (SELECT total_check_ins::int FROM attendance.attendance_summary
   WHERE event_id = :event_id AND branch_id = :branch_id),
  2,
  'summary counts 2 check-ins'
);

SELECT is(
  (SELECT unique_persons::int FROM attendance.attendance_summary
   WHERE event_id = :event_id AND branch_id = :branch_id),
  2,
  'summary counts 2 unique persons'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V041__attendance_summary_view.sql`**

```sql
CREATE VIEW attendance.attendance_summary AS
SELECT
  c.event_id,
  c.branch_id,
  date_trunc('week', c.checked_in_at)::date AS week_start,
  count(*) AS total_check_ins,
  count(DISTINCT c.person_id) AS unique_persons,
  count(c.ftv_capture_id) AS ftv_count
FROM attendance.check_in c
GROUP BY c.event_id, c.branch_id, date_trunc('week', c.checked_in_at)::date;

COMMENT ON VIEW attendance.attendance_summary IS 'Weekly attendance aggregates by event and branch. Regular view; convert to materialized when dashboard performance demands it.';
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V041__attendance_summary_view.sql \
        db/tests/33_attendance_summary.sql
git commit -m "feat(db): add attendance_summary view (weekly aggregates by event/branch)"
```

---

### Task 12: DB roles + PII grants

**Files:**
- Create: `db/migrations/V042__plan2_roles_and_grants.sql`
- Create: `db/tests/34_plan2_roles.sql`

- [ ] **Step 1: Write `db/tests/34_plan2_roles.sql`**

```sql
BEGIN;
SELECT plan(6);

SELECT has_role('attendance_writer', 'attendance_writer role exists');

-- attendance_writer can INSERT into check_in
SET LOCAL ROLE attendance_writer;
PREPARE writer_insert AS
  INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (1, 1, 1, '2026-04-20 09:00:00+08');
-- This will fail with FK violation (no event_id=1) but NOT with permission denied.
-- We test that the permission is granted, not that data exists.
RESET ROLE;

-- app_general cannot read PII tables
SET LOCAL ROLE app_general;
PREPARE reg_read AS SELECT registration_id FROM events.event_registration LIMIT 1;
SELECT throws_ok('reg_read', '42501', NULL, 'app_general cannot read event_registration');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE vc_read AS SELECT ftv_capture_id FROM attendance.visitor_capture LIMIT 1;
SELECT throws_ok('vc_read', '42501', NULL, 'app_general cannot read visitor_capture');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE cc_read AS SELECT check_in_id FROM attendance.child_check_in LIMIT 1;
SELECT throws_ok('cc_read', '42501', NULL, 'app_general cannot read child_check_in');
RESET ROLE;

-- app_general CAN read non-PII tables
SET LOCAL ROLE app_general;
PREPARE net_read AS SELECT network_id FROM ministries.network LIMIT 1;
SELECT lives_ok('net_read', 'app_general can read ministries.network');
RESET ROLE;

SET LOCAL ROLE app_general;
PREPARE evt_read AS SELECT event_id FROM events.event LIMIT 1;
SELECT lives_ok('evt_read', 'app_general can read events.event');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Write `db/migrations/V042__plan2_roles_and_grants.sql`**

```sql
-- ============================================================================
-- attendance_writer: check-in kiosk/app role (INSERT/UPDATE only)
-- ============================================================================
CREATE ROLE attendance_writer NOLOGIN;
GRANT USAGE ON SCHEMA attendance TO attendance_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA attendance TO attendance_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA attendance TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT INSERT, UPDATE ON TABLES TO attendance_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA attendance
  GRANT USAGE, SELECT ON SEQUENCES TO attendance_writer;

-- attendance_writer needs SELECT on referenced tables for FK validation
GRANT USAGE ON SCHEMA events, core, membership TO attendance_writer;
GRANT SELECT ON events.event TO attendance_writer;
GRANT SELECT ON core.person, core.branch TO attendance_writer;
GRANT SELECT ON membership.member TO attendance_writer;

-- ============================================================================
-- Extend existing roles for new schemas
-- ============================================================================

-- app_full: full read/write access
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_full;
GRANT ALL ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_full;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ministries, events, attendance TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT ALL ON TABLES TO app_full;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT USAGE, SELECT ON SEQUENCES TO app_full;

-- app_pastoral: full read including PII
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_pastoral;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_pastoral;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_pastoral;

-- app_general: read access excluding PII tables
GRANT USAGE ON SCHEMA ministries, events, attendance TO app_general;
GRANT SELECT ON ALL TABLES IN SCHEMA ministries, events, attendance TO app_general;
REVOKE SELECT ON events.event_registration FROM app_general;
REVOKE SELECT ON attendance.visitor_capture FROM app_general;
REVOKE SELECT ON attendance.child_check_in FROM app_general;
ALTER DEFAULT PRIVILEGES IN SCHEMA ministries, events, attendance
  GRANT SELECT ON TABLES TO app_general;
```

- [ ] **Step 4: Apply and re-run tests**

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V042__plan2_roles_and_grants.sql \
        db/tests/34_plan2_roles.sql
git commit -m "feat(db): add attendance_writer role and extend PII grants for new schemas"
```

---

### Task 13: End-to-end smoke test

**Files:**
- Modify: `db/tests/99_smoke_e2e.sql`

- [ ] **Step 1: Add operational layer scenarios to `db/tests/99_smoke_e2e.sql`**

Append after the existing 8 tests (change `plan(8)` to `plan(14)`):

```sql
-- ==================== Plan 2: Operational Layer ====================

-- Create a ministry chapter and assign Juan as leader
INSERT INTO ministries.ministry_chapter (ministry_id, branch_id)
  VALUES ((SELECT ministry_id FROM ministries.ministry WHERE code='MOVE'), :branch_id)
  RETURNING chapter_id \gset

INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
  VALUES (:chapter_id, :jdc_member, now(), true, 'HEAD');

SELECT is(
  (SELECT count(*)::int FROM ministries.ministry_membership
   WHERE chapter_id = :chapter_id AND is_leader = true),
  1,
  'Juan is leader of Move chapter'
);

-- Create an event and check in
INSERT INTO events.event (event_type_id, name, starts_at, branch_id, status)
  VALUES ((SELECT event_type_id FROM events.event_type WHERE code='SUNDAY_SERVICE'),
          'Sunday Service Apr 20', '2026-04-20 09:00:00+08', :branch_id, 'SCHEDULED')
  RETURNING event_id AS svc_event_id \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:svc_event_id, :jdc_id, :branch_id, '2026-04-20 09:10:00+08', 'SELF');
INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, check_in_method)
  VALUES (:svc_event_id, :mdc_id, :branch_id, '2026-04-20 09:12:00+08', 'USHER');

SELECT is(
  (SELECT total_check_ins::int FROM attendance.attendance_summary
   WHERE event_id = :svc_event_id),
  2,
  'attendance summary shows 2 check-ins'
);

-- FTV capture: new visitor at the service
INSERT INTO core.person (first_name, last_name) VALUES ('New', 'Visitor')
  RETURNING person_id AS ftv_pid \gset

INSERT INTO attendance.visitor_capture (person_id, event_id, branch_id, consent_to_contact, intake_notes)
  VALUES (:ftv_pid, :svc_event_id, :branch_id, true, 'Friend of Juan')
  RETURNING ftv_capture_id \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at, ftv_capture_id)
  VALUES (:svc_event_id, :ftv_pid, :branch_id, '2026-04-20 09:20:00+08', :ftv_capture_id);

SELECT is(
  (SELECT ftv_count::int FROM attendance.attendance_summary
   WHERE event_id = :svc_event_id),
  1,
  'summary counts 1 FTV check-in'
);

-- Child check-in with pickup code
INSERT INTO core.person (first_name, last_name) VALUES ('Kid', 'Dela Cruz')
  RETURNING person_id AS kid_pid \gset

INSERT INTO attendance.check_in (event_id, person_id, branch_id, checked_in_at)
  VALUES (:svc_event_id, :kid_pid, :branch_id, '2026-04-20 09:05:00+08')
  RETURNING check_in_id AS kid_ci_id, checked_in_at AS kid_ci_at \gset

INSERT INTO attendance.child_check_in
  (check_in_id, checked_in_at, event_id, pickup_code, allergies)
  VALUES (:kid_ci_id, :kid_ci_at, :svc_event_id, 'MNL-K-9472', 'None');

SELECT pass('child check-in with pickup code succeeds');

-- Event registration for a big event
INSERT INTO events.event (event_type_id, name, starts_at, status)
  VALUES ((SELECT event_type_id FROM events.event_type WHERE code='CAMP_MEETING'),
          'Camp Meeting 2026', '2026-07-01 08:00:00+08', 'SCHEDULED')
  RETURNING event_id AS cm_event_id \gset

INSERT INTO events.event_registration (event_id, person_id, status, group_size, accommodation_required)
  VALUES (:cm_event_id, :jdc_id, 'CONFIRMED', 3, true);

SELECT is(
  (SELECT group_size FROM events.event_registration WHERE event_id = :cm_event_id AND person_id = :jdc_id),
  3,
  'Camp Meeting registration with group_size=3'
);
```

- [ ] **Step 2: Update `plan(8)` to `plan(14)` in the existing file**

The existing smoke test has 8 tests. Adding 6 new ones brings it to 14.

- [ ] **Step 3: Run the full test suite from scratch**

```bash
cd db
docker compose down -v
docker compose up -d postgres
sleep 10
docker compose run --rm pgtap_installer
docker compose run --rm flyway migrate
./tests/run_tests.sh
```

Expected: all tests pass across all files.

- [ ] **Step 4: Commit**

```bash
git add db/tests/99_smoke_e2e.sql
git commit -m "test(db): extend e2e smoke test with ministry/event/attendance/child-check-in scenarios"
git tag plan-2-operational-complete
```

---

## Self-Review Checklist

- [ ] All 13 tasks completed with green tests.
- [ ] `git tag plan-2-operational-complete` exists.
- [ ] `ministries` schema: network (3 seeded), ministry (9 seeded), chapter, membership with leader CHECK.
- [ ] `events` schema: category (2 seeded), type (15 seeded), series, event, organizer (composite PK), registration (PII).
- [ ] `attendance` schema: check_in (partitioned April + May 2026), visitor_capture, child_check_in (pickup_code unique per event), summary view.
- [ ] `attendance_writer` role with INSERT/UPDATE on attendance + SELECT on referenced tables.
- [ ] PII tables revoked from `app_general`: event_registration, visitor_capture, child_check_in.
- [ ] PII COMMENT markers on emergency_contact_name, emergency_contact_phone, dietary_requirements, intake_notes, allergies.
- [ ] All repeatable seeds use ON CONFLICT DO UPDATE for idempotency.
- [ ] Partitioned check_in has composite PK `(check_in_id, checked_in_at)` for partition routing.
- [ ] child_check_in FK uses composite `(check_in_id, checked_in_at)` to reference partitioned parent.

---

## What's next (Plans 3-4)

- **Plan 3 (Specialized domains):** `programs` (Heartlink cohorts + sessions), `missions` (Scholars + BAC), `education` (BC + ISU).
- **Plan 4 (Migration):** `staging` schema, Python ETL from Google Sheets, FK-respecting promotion, cutover scripts.
