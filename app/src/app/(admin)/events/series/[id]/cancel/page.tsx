// app/src/app/(admin)/events/series/[id]/cancel/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventSeries } from "@/schema/events";
import { and, eq, gt, sql } from "drizzle-orm";
import { cancelSeries } from "@/actions/series";

export default async function CancelSeriesPage({
  params,
}: {
  params: { id: string };
}) {
  const seriesId = Number(params.id);
  if (!Number.isInteger(seriesId) || seriesId <= 0) notFound();

  const [series] = await db
    .select({
      seriesId: eventSeries.seriesId,
      name: eventSeries.name,
      status: eventSeries.status,
    })
    .from(eventSeries)
    .where(eq(eventSeries.seriesId, seriesId))
    .limit(1);
  if (!series) notFound();

  const futureOccurrences = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      registrationCount: sql<number>`(
        select count(*) from events.event_registration er
        where er.event_id = ${event.eventId}
          and er.status != 'CANCELLED'
      )`.mapWith(Number),
    })
    .from(event)
    .where(
      and(
        eq(event.seriesId, seriesId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(event.status, "SCHEDULED" as any),
        gt(event.startsAt, new Date())
      )
    )
    .orderBy(event.startsAt);

  async function confirmCancel() {
    "use server";
    await cancelSeries(seriesId);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/events/series"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Recurring series
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Cancel series: {series.name}
        </h1>
      </div>

      {series.status !== "ACTIVE" ? (
        <p className="text-gray-500">This series is already ended.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            This ends the series and cancels the {futureOccurrences.length}{" "}
            upcoming occurrence{futureOccurrences.length === 1 ? "" : "s"}{" "}
            below. Past events are not affected. This cannot be undone.
          </p>

          {futureOccurrences.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {futureOccurrences.map((o) => (
                <li
                  key={o.eventId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-gray-900">
                    {new Date(o.startsAt).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {o.registrationCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      {o.registrationCount} registration
                      {o.registrationCount === 1 ? "" : "s"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={confirmCancel} className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cancel series
            </button>
            <Link
              href="/events/series"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Keep series
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
