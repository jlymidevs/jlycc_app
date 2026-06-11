# Attendance Audit Dashboard — Design

**Date:** 2026-06-11
**Status:** Approved

## Goal

Surface attendance/engagement insight for two audiences:

- **Admin** — church-wide weekly attendance trends on the existing `/events/attendance` page.
- **Member** — personal attendance history on `/me`.

No new database tables or migrations. All data comes from existing `attendance.check_in` and the `attendance.attendance_summary` view.

## Scope decisions

- Audit = attendance/engagement only (not activity logs, not data-health checks).
- Admin sees aggregates; members see only their own history.
- Admin view extends `/events/attendance` (no new route, no new nav item).
- Server-rendered with zero new dependencies — inline SVG bar chart, Tailwind styling, matching the codebase's all-server-component pattern.

Out of scope (explicitly deferred): inactive-member alerts, FTV funnel analysis, ministry participation stats, per-member admin drill-down, chart library, CSV export.

## Section 1 — Admin: weekly trend on `/events/attendance`

File: `app/src/app/(admin)/events/attendance/page.tsx` (extend existing page).

- New "Weekly trend" section rendered **above** the existing summary table.
- **Data:** aggregate `attendance_summary` rows per `week_start` — `SUM(total_check_ins)`, `SUM(unique_persons)`, `SUM(ftv_count)` across all events. Respects the existing `branchId` and `range` query-param filters. Weeks sorted ascending for the chart.
- **Stat cards row** above the chart: total check-ins, average per week, total FTV — all for the selected range/branch.
- **Chart:** inline SVG grouped bar chart, server-rendered. Check-ins as primary bars, FTV as a smaller secondary bar per week. Week label on the x-axis, value printed above each bar (no JS interactivity). Max ~52 bars (year range).
- New component `app/src/components/trend-chart.tsx` — a server component taking `{ week: string; checkIns: number; ftv: number }[]` and rendering the SVG. Keeps the page file readable.
- Aggregation logic extracted to `app/src/lib/attendance-trends.ts` as a pure function (rows in, weekly buckets out) so it is unit-testable.
- Empty state: render the section header with a short "No attendance data for the selected filters." line (same copy as the existing table empty state).

## Section 2 — Member: "My attendance" on `/me`

File: `app/src/app/me/page.tsx` (extend existing page).

- New card section after "Journey".
- **Stats row:** total check-ins (all time), check-ins this calendar year, last attended date.
- **List:** last 10 check-ins — event name + check-in date, newest first.
- **Query:** `attendance.check_in` JOIN `events.event` WHERE `person_id = <member's personId>`, order by check-in time desc. The existing `users` lookup in the page must additionally select `users.personId` (currently joined through to `member`/`person` — reuse `member.personId` already available in that join chain).
- Empty state: "No attendance recorded yet."
- Auth: unchanged — page already gated by `requireRole("MEMBER")`. Members only ever see their own rows because the query is keyed on their own `personId`.

## Error handling

- Both pages are server components; DB errors surface through the existing Next.js error boundary behavior (same as every other page in the app). No special handling added.
- Defensive defaults: division for avg/week guards against zero weeks; missing/null counts treated as 0.

## Testing

- **Unit (vitest):** `attendance-trends.ts` aggregation — group rows by week, sum metrics, sort ascending; cases: empty input, single week, multiple events same week, null-ish counts.
- **E2E:** no new spec. Existing attendance spec covers page load; manual verification of both pages against seeded local DB.
- **Static:** `npx tsc --noEmit` clean.

## Files touched

| File | Change |
|------|--------|
| `app/src/app/(admin)/events/attendance/page.tsx` | Add stat cards + trend section |
| `app/src/components/trend-chart.tsx` | New — SVG bar chart server component |
| `app/src/lib/attendance-trends.ts` | New — pure aggregation helper |
| `app/src/app/me/page.tsx` | Add "My attendance" section + query |
| `app/tests/unit/attendance-trends.test.ts` | New — unit tests for helper |
