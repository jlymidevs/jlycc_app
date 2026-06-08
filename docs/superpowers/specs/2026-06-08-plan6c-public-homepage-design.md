# JLY Church App — Plan 6c: Public Church Homepage Design

## Goal

Add a public-facing church homepage at `/church` with a hero section and upcoming events list. Add a shared public nav layout wrapping all `/church/*` pages.

## Scope

**In scope (Plan 6c):**
- `church/layout.tsx` — shared public nav (church name + Events link)
- `church/page.tsx` — homepage: hero banner + next 5 upcoming events + Register CTAs

**Out of scope:**
- Branch locations / contact info
- Announcements / sermons
- Public user accounts
- Any changes to existing `/church/events` pages

---

## Architecture

### New Files

```
app/src/app/church/
├── layout.tsx          NEW — public nav wrapper for all /church/* routes
└── page.tsx            NEW — homepage
```

### Modified Files

None. Existing `/church/events/page.tsx` and `/church/events/[id]/page.tsx` automatically inherit the new layout — no changes needed.

### No New Migrations

Reuses `events.event` and `events.event_type` Drizzle tables.

---

## Layout (`church/layout.tsx`)

Simple nav bar — no auth, no session check:
- Left: "JLY Church" text link → `/church`
- Right: "Events" link → `/church/events`
- Wraps `{children}` in a `<main>` container

---

## Homepage (`church/page.tsx`)

- `export const dynamic = "force-dynamic"`
- Query: next 5 events with status IN (`SCHEDULED`, `IN_PROGRESS`), ordered by `startsAt ASC` — same pattern as existing public events listing
- Selects: `eventId`, `name`, `startsAt`, `endsAt`, `venue`, `eventTypeName`

**UI sections:**
1. **Hero** — `<h1>JLY Church</h1>` + tagline `<p>` + "See all events" link → `/church/events`
2. **Upcoming Events** — list of up to 5 event cards: name, event type badge, date/time, venue, "Register →" link to `/church/events/[id]`
3. **Empty state** — "No upcoming events at this time." when query returns 0 rows

---

## Testing

**No unit tests** — no business logic to test; pure data-fetch + render.

**E2E tests** (`tests/e2e/homepage.spec.ts`):
- Homepage loads at `/church` with "JLY Church" heading visible
- "Events" nav link navigates to `/church/events`
- (Graceful skip if no events in DB)

---

## Notes

- The layout automatically adds nav to existing `/church/events` and `/church/events/[id]` pages — no code changes needed to those files.
- Tagline is hardcoded: "Love God. Love People. Change the World." (can be updated in code later).
