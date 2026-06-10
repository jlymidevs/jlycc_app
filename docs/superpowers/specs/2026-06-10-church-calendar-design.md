# Church Calendar + Add-to-Calendar + Recurring Series — Design

**Date:** 2026-06-10
**Status:** Approved
**Scope:** Phase 1 of member-experience roadmap

## Goal

Give members a public church calendar so they can see all church activities and add
any event to their personal calendar (Google Calendar link + ICS download) for
reminders. Give admins recurring-series support so weekly services appear on the
calendar without manual event creation each week.

## Decisions (from brainstorming)

1. **Placement:** Public `/church/calendar` page only. No changes to event detail
   page or member portal in this phase.
2. **Layout:** Month grid + agenda list toggle. Grid default on desktop, list
   default on mobile. Toggle preference persists in `localStorage`.
3. **Recurring events:** In scope. Admin defines a series; system materializes
   real `event` rows.
4. **Recurrence mechanics:** Materialized rows (~3 months ahead, topped up
   lazily). Registration, attendance, QR check-in work unchanged per occurrence.
5. **Series editing:** Create + cancel only. No "edit whole series" propagation.
   Individual occurrences are normal events, editable via the existing edit page.

## Existing Schema (no migration needed)

`app/src/schema/events.ts` already defines everything required:

- `event_series` table: `seriesId`, `eventTypeId`, `branchId`, `name`,
  `recurrencePattern` (DAILY/WEEKLY/MONTHLY/YEARLY enum), `recurrenceConfig`
  (jsonb), `startsOn`, `endsOn`, `status` (ACTIVE/PAUSED/ENDED enum).
- `event.seriesId` FK → `event_series.series_id`.

`recurrence_config` jsonb shape (validated with Zod):

```ts
{
  dayOfWeek?: number;      // 0–6, required for WEEKLY
  dayOfMonth?: number;     // 1–31, required for MONTHLY
  time: string;            // "HH:mm", Asia/Manila local
  durationMinutes: number; // computes endsAt
  venue?: string;
}
```

Phase 1 exposes only WEEKLY and MONTHLY in the admin UI (enum supports more).

## Components

### 1. Public calendar page — `app/src/app/church/calendar/page.tsx`

- Server component. Reads `?month=YYYY-MM` searchParam; defaults to current
  month in Asia/Manila.
- Queries events where `startsAt` falls in the visible month and status is
  SCHEDULED or IN_PROGRESS, joined with `event_type` (and its `category_code`).
- Optional `?type=<eventTypeId>` filter via filter chips (links, server-side
  filtering).
- Header: month title, prev/next month links, "Today" link, type filter chips,
  grid/list toggle.
- **Grid view:** 7-column month grid (Sun–Sat) built with Tailwind. Events render
  as colored pills (color keyed by event category). Pill links to
  `/church/events/[id]`. Max 3 pills per day cell, then "+N more" linking to
  list view anchored to that date.
- **List view:** agenda grouped by date; each row shows time, name, type, venue,
  Register link, and Add-to-Calendar buttons (Google + .ics).
- Toggle is a small client component; renders both views and switches
  visibility, persisting choice in `localStorage`. Default: grid on ≥768px,
  list below (CSS default before hydration to avoid flash).
- "Calendar" nav link added to `app/src/app/church/layout.tsx`.

### 2. Add to Calendar — `app/src/lib/calendar-links.ts` + ICS route

- `googleCalendarUrl(event)` → `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&location=...&details=...`
  with UTC-formatted dates. If `endsAt` is null, default to start + 2 hours.
- `buildIcs(event)` → VCALENDAR/VEVENT plain text: `UID` =
  `event-<id>@jlycc`, `DTSTART`/`DTEND` in UTC, `SUMMARY`, `LOCATION`,
  `URL` (public event detail), proper CRLF line endings and text escaping.
- Route handler `app/src/app/church/events/[id]/calendar.ics/route.ts`:
  fetches event, returns 404 if missing/cancelled, else `text/calendar` with
  `Content-Disposition: attachment; filename="<slug>.ics"`.
- Buttons appear on calendar list view rows: "Google Calendar" (external link)
  and "Download .ics".

### 3. Recurring series (admin)

- **Pages:**
  - `/events/series` — table of series (name, pattern summary, status, next
    occurrence) + "New Series" button. Link from admin events page.
  - `/events/series/new` — form: name, event type, branch, pattern
    (WEEKLY/MONTHLY), day-of-week or day-of-month (switches with pattern),
    time, duration minutes, venue, start date, optional end date.
- **Server actions** (`app/src/actions/series.ts`):
  - `createSeries(input)` — Zod-validates, inserts `event_series`, runs
    generator, redirects to series list.
  - `cancelSeries(seriesId)` — sets series status ENDED, updates future
    SCHEDULED occurrences (startsAt > now) to CANCELLED. Confirmation step
    lists affected occurrences and flags any with non-cancelled registrations.
- **Generator** (`app/src/lib/series-generator.ts`):
  - `expandSeriesDates(series, from, to)` — pure function returning occurrence
    Date list from pattern + config. Weekly: every matching dayOfWeek. Monthly:
    matching dayOfMonth (skip months without that day, e.g. 31st). Respects
    `startsOn`/`endsOn`. All math done in Asia/Manila local time, stored UTC.
  - `generateOccurrences(seriesId)` — materializes `event` rows up to 3 months
    ahead for one series. Idempotent: skips dates where an event with the same
    `seriesId` + `startsAt` already exists. Generated rows copy name/venue/
    branch/type from series + config; `expectedAttendance` null; status
    SCHEDULED.
  - `topUpAllSeries()` — for each ACTIVE series, runs `generateOccurrences`.
    Called fire-and-forget on admin events page load and public calendar page
    load. Cheap short-circuit: skip series whose max generated `startsAt` is
    already ≥ 3 months out.

## Error Handling

- Invalid `?month` param → fall back to current month (no error page).
- ICS route: 404 for unknown or CANCELLED events.
- Series form: Zod errors rendered inline (same pattern as existing forms).
- Generator failures on page load are logged, never block page render.

## Testing

- **Vitest:**
  - `expandSeriesDates`: weekly across month boundary, monthly incl. 31st-skip,
    startsOn/endsOn clamping, Manila-local correctness.
  - `generateOccurrences` idempotency (run twice → no duplicates).
  - `buildIcs` output format (CRLF, escaping, UTC timestamps).
  - `googleCalendarUrl` encoding.
- **Playwright:**
  - Calendar page renders current month with seeded event.
  - Prev/next navigation changes month.
  - Admin creates weekly series → occurrences visible on public calendar.
  - Cancel series → future occurrences disappear from calendar.

## Out of Scope (later phases)

- Add-to-calendar on event detail page and member portal.
- Edit-series propagation, PAUSED status handling beyond exclusion.
- Subscribe-to-feed (whole-calendar ICS URL).
- Member-facing RSVP from calendar (uses existing register flow).
