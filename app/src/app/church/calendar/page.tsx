// app/src/app/church/calendar/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import {
  parseMonthParam,
  monthGridDays,
  monthRangeUtc,
  manilaDateOf,
  currentManilaMonth,
} from "@/lib/month-grid";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { topUpAllSeries } from "@/lib/series-generator";
import CalendarViewToggle from "@/components/calendar-view-toggle";

const PILL_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

function categoryColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return PILL_COLORS[h % PILL_COLORS.length];
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ChurchCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; type?: string };
}) {
  await topUpAllSeries(); // never throws

  const { year, month } = parseMonthParam(searchParams.month);
  const { start, end } = monthRangeUtc(year, month);
  const typeFilter = searchParams.type ? Number(searchParams.type) : undefined;

  const conditions = [
    inArray(event.status, [
      "SCHEDULED",
      "IN_PROGRESS",
    ] as ("SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED")[]),
    gte(event.startsAt, start),
    lt(event.startsAt, end),
  ];
  if (typeFilter && Number.isInteger(typeFilter)) {
    conditions.push(eq(event.eventTypeId, typeFilter));
  }

  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      eventTypeId: event.eventTypeId,
      eventTypeName: eventType.name,
      categoryCode: eventType.categoryCode,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(and(...conditions))
    .orderBy(asc(event.startsAt));

  const types = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);

  // Bucket events by Manila calendar date
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = manilaDateOf(r.startsAt);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(r);
    else byDate.set(key, [r]);
  }

  const cells = monthGridDays(year, month);
  const todayStr = manilaDateOf(new Date());
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const monthParam = `${year}-${String(month).padStart(2, "0")}`;
  const qs = (m: string) =>
    `?month=${m}${typeFilter ? `&type=${typeFilter}` : ""}`;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    });

  const grid = (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200 text-center text-xs font-medium text-gray-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-24 border-b border-r border-gray-100 p-1 ${
                cell.inMonth ? "bg-white" : "bg-gray-50"
              }`}
            >
              <div
                className={`mb-1 text-xs ${
                  cell.date === todayStr
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-semibold text-white"
                    : cell.inMonth
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {Number(cell.date.slice(8, 10))}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <Link
                    key={e.eventId}
                    href={`/church/events/${e.eventId}`}
                    className={`block truncate rounded px-1 py-0.5 text-xs ${categoryColor(e.categoryCode)}`}
                    title={`${e.name} · ${fmtTime(e.startsAt)}`}
                  >
                    {e.name}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-xs text-gray-500">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const listDates = Array.from(byDate.keys()).sort();
  const list = (
    <div className="space-y-6">
      {listDates.length === 0 ? (
        <p className="text-gray-500">No events this month.</p>
      ) : (
        listDates.map((date) => (
          <div key={date} id={`d-${date}`} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">
              {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </h3>
            {(byDate.get(date) ?? []).map((e) => (
              <div
                key={e.eventId}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/church/events/${e.eventId}`}
                      className="font-medium text-gray-900 hover:text-blue-700"
                    >
                      {e.name}
                    </Link>
                    <p className="text-xs text-gray-500">{e.eventTypeName}</p>
                  </div>
                  <Link
                    href={`/church/events/${e.eventId}`}
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Register
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>🕘 {fmtTime(e.startsAt)}</span>
                  {e.venue && <span>📍 {e.venue}</span>}
                </div>
                <div className="flex gap-3 text-sm">
                  <a
                    href={googleCalendarUrl(
                      e,
                      `${base}/church/events/${e.eventId}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Add to Google Calendar
                  </a>
                  <a
                    href={`/church/events/${e.eventId}/calendar.ics`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Download .ics
                  </a>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          {monthLabel(year, month)}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/church/calendar${qs(shiftMonth(year, month, -1))}`}
            aria-label="Previous month"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ←
          </Link>
          <Link
            href={`/church/calendar${qs(currentManilaMonth())}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Today
          </Link>
          <Link
            href={`/church/calendar${qs(shiftMonth(year, month, 1))}`}
            aria-label="Next month"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/church/calendar?month=${monthParam}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !typeFilter
              ? "bg-blue-600 text-white"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t.eventTypeId}
            href={`/church/calendar?month=${monthParam}&type=${t.eventTypeId}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              typeFilter === t.eventTypeId
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.name}
          </Link>
        ))}
      </div>

      <CalendarViewToggle grid={grid} list={list} />
    </div>
  );
}
