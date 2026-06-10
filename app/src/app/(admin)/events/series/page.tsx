// app/src/app/(admin)/events/series/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { eventSeries, eventType } from "@/schema/events";
import { eq, desc } from "drizzle-orm";
import type { RecurrenceConfig } from "@/lib/validations/series";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function patternSummary(
  pattern: string,
  config: RecurrenceConfig
): string {
  if (pattern === "WEEKLY" && config.dayOfWeek !== undefined) {
    return `Every ${DAYS[config.dayOfWeek]} at ${config.time}`;
  }
  if (pattern === "MONTHLY" && config.dayOfMonth !== undefined) {
    return `Day ${config.dayOfMonth} of each month at ${config.time}`;
  }
  return pattern;
}

export default async function SeriesListPage() {
  const rows = await db
    .select({
      seriesId: eventSeries.seriesId,
      name: eventSeries.name,
      recurrencePattern: eventSeries.recurrencePattern,
      recurrenceConfig: eventSeries.recurrenceConfig,
      startsOn: eventSeries.startsOn,
      endsOn: eventSeries.endsOn,
      status: eventSeries.status,
      eventTypeName: eventType.name,
    })
    .from(eventSeries)
    .innerJoin(eventType, eq(eventSeries.eventTypeId, eventType.eventTypeId))
    .orderBy(desc(eventSeries.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/events"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Recurring series
          </h1>
        </div>
        <Link
          href="/events/series/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New series
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No recurring series yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Schedule</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.seriesId} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-900">{s.name}</td>
                <td className="py-2 pr-4 text-gray-600">{s.eventTypeName}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {patternSummary(
                    s.recurrencePattern,
                    s.recurrenceConfig as RecurrenceConfig
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "ACTIVE"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {s.status === "ACTIVE" && (
                    <Link
                      href={`/events/series/${s.seriesId}/cancel`}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel series
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
