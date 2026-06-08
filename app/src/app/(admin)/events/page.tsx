// app/src/app/(admin)/events/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { eq, desc, inArray } from "drizzle-orm";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "upcoming";

  const statusValues =
    statusFilter === "past"
      ? (["COMPLETED", "CANCELLED"] as const)
      : (["SCHEDULED", "IN_PROGRESS"] as const);

  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(inArray(event.status, statusValues as unknown as any[]))
    .orderBy(desc(event.startsAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add event
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/events?status=upcoming"
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusFilter !== "past"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/events?status=past"
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusFilter === "past"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Past
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No events found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-3 pr-4 font-medium">Name</th>
              <th className="py-3 pr-4 font-medium">Type</th>
              <th className="py-3 pr-4 font-medium">Starts</th>
              <th className="py-3 pr-4 font-medium">Venue</th>
              <th className="py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.eventId}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/events/${e.eventId}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {e.name}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-gray-600">{e.eventTypeName}</td>
                <td className="py-3 pr-4 text-gray-600">
                  {new Date(e.startsAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 pr-4 text-gray-600">{e.venue ?? "—"}</td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.status === "SCHEDULED"
                        ? "bg-green-50 text-green-700"
                        : e.status === "IN_PROGRESS"
                        ? "bg-yellow-50 text-yellow-700"
                        : e.status === "CANCELLED"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-700"
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
