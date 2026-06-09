// app/src/app/(admin)/events/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType, eventRegistration } from "@/schema/events";
import { person, contactInfo } from "@/schema/core";
import { cancelEvent } from "@/actions/events";
import { updateRegistrationStatus } from "@/actions/registrations";
import { eq, and, desc } from "drizzle-orm";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  const registrants = await db
    .select({
      registrationId: eventRegistration.registrationId,
      status: eventRegistration.status,
      registeredAt: eventRegistration.registeredAt,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(eventRegistration)
    .innerJoin(person, eq(eventRegistration.personId, person.personId))
    .leftJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, person.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(eq(eventRegistration.eventId, eventId))
    .orderBy(desc(eventRegistration.registeredAt));

  const isCancellable =
    eventRow.status === "SCHEDULED" || eventRow.status === "IN_PROGRESS";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/events" className="text-sm text-gray-500 hover:text-gray-900">
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {eventRow.name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{eventRow.eventTypeName}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/events/${eventId}/attendance`}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Attendance
          </Link>
          {isCancellable && (
            <>
              <Link
                href={`/events/${eventId}/edit`}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </Link>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <form action={cancelEvent.bind(null, eventId) as any}>
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Cancel event
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Status</dt>
          <dd className="mt-1">{eventRow.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Venue</dt>
          <dd className="mt-1">{eventRow.venue ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Starts</dt>
          <dd className="mt-1">
            {new Date(eventRow.startsAt).toLocaleString("en-PH")}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Ends</dt>
          <dd className="mt-1">
            {eventRow.endsAt
              ? new Date(eventRow.endsAt).toLocaleString("en-PH")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Expected attendance</dt>
          <dd className="mt-1">{eventRow.expectedAttendance ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Public registration link</dt>
          <dd className="mt-1">
            <Link
              href={`/church/events/${eventId}`}
              className="text-blue-600 hover:underline text-xs"
              target="_blank"
            >
              /church/events/{eventId}
            </Link>
          </dd>
        </div>
      </dl>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Registrants ({registrants.length})
        </h2>
        {registrants.length === 0 ? (
          <p className="text-sm text-gray-500">No registrations yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Registered</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr key={r.registrationId} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {r.lastName}, {r.firstName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{r.email ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {new Date(r.registeredAt).toLocaleDateString("en-PH")}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "CONFIRMED"
                          ? "bg-green-50 text-green-700"
                          : r.status === "WAITLISTED"
                          ? "bg-yellow-50 text-yellow-700"
                          : r.status === "CANCELLED"
                          ? "bg-red-50 text-red-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {r.status !== "CONFIRMED" &&
                        r.status !== "CANCELLED" && (
                          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                          <form action={updateRegistrationStatus.bind(null, r.registrationId, "CONFIRMED") as any}>
                            <button
                              type="submit"
                              className="text-xs text-green-700 hover:underline"
                            >
                              Confirm
                            </button>
                          </form>
                        )}
                      {r.status !== "CANCELLED" && (
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        <form action={updateRegistrationStatus.bind(null, r.registrationId, "CANCELLED") as any}>
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
