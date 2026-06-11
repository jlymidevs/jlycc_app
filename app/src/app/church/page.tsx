export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, inArray, asc } from "drizzle-orm";

export default async function ChurchHomePage() {
  const upcomingEvents = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      venue: event.venue,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(
      inArray(
        event.status,
        ["SCHEDULED", "IN_PROGRESS"] as (
          | "SCHEDULED"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED"
        )[]
      )
    )
    .orderBy(asc(event.startsAt))
    .limit(5);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jlycc-logo.png" alt="JLYCC" width={96} height={96} className="mx-auto" style={{ objectFit: "contain" }} />
        <h1 className="text-4xl font-bold text-gray-900">JLYCC</h1>
        <p className="text-lg text-gray-600">
          Love God. Love People. Change the World.
        </p>
        <Link
          href="/church/events"
          className="inline-block rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          See all events
        </Link>
      </section>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500">No upcoming events at this time.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((e) => (
              <div
                key={e.eventId}
                className="rounded-lg border border-gray-200 bg-white p-5 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.eventTypeName}</p>
                  <div className="flex gap-3 text-sm text-gray-600">
                    <span>
                      {new Date(e.startsAt).toLocaleDateString("en-PH", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {e.venue && <span>· {e.venue}</span>}
                  </div>
                </div>
                <Link
                  href={`/church/events/${e.eventId}`}
                  className="ml-4 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Register →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
