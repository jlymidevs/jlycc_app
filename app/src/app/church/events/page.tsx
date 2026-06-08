// app/src/app/church/events/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, inArray, asc } from "drizzle-orm";

export default async function PublicEventsPage() {
  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(inArray(event.status, ["SCHEDULED", "IN_PROGRESS"] as unknown as any[]))
    .orderBy(asc(event.startsAt))
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upcoming Events</h1>
        <p className="mt-2 text-gray-600">Join us at our upcoming church events.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No upcoming events at this time.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((e) => (
            <div
              key={e.eventId}
              className="rounded-lg border border-gray-200 bg-white p-5 space-y-2 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {e.name}
                  </h2>
                  <p className="text-sm text-gray-500">{e.eventTypeName}</p>
                </div>
                <Link
                  href={`/church/events/${e.eventId}`}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
              <div className="flex gap-4 text-sm text-gray-600">
                <span>
                  📅{" "}
                  {new Date(e.startsAt).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {e.venue && <span>📍 {e.venue}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
