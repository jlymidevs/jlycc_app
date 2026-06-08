// app/src/app/(admin)/events/[id]/edit/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { updateEvent } from "@/actions/events";
import { eq } from "drizzle-orm";

function toDatetimeLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [[eventRow], eventTypes] = await Promise.all([
    db
      .select({
        eventId: event.eventId,
        name: event.name,
        eventTypeId: event.eventTypeId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venue: event.venue,
        expectedAttendance: event.expectedAttendance,
      })
      .from(event)
      .where(eq(event.eventId, eventId))
      .limit(1),
    db
      .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
      .from(eventType)
      .orderBy(eventType.name),
  ]);

  if (!eventRow) notFound();

  const action = updateEvent.bind(null, eventId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Event detail
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit event</h1>
      </div>

      <form action={(fd) => void action(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            defaultValue={eventRow.name}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event type <span className="text-red-500">*</span>
          </label>
          <select
            name="eventTypeId"
            defaultValue={eventRow.eventTypeId}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {eventTypes.map((et) => (
              <option key={et.eventTypeId} value={et.eventTypeId}>
                {et.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts at <span className="text-red-500">*</span>
            </label>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(new Date(eventRow.startsAt))}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ends at
            </label>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={
                eventRow.endsAt ? toDatetimeLocal(new Date(eventRow.endsAt)) : ""
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Venue
          </label>
          <input
            name="venue"
            type="text"
            defaultValue={eventRow.venue ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected attendance
          </label>
          <input
            name="expectedAttendance"
            type="number"
            min="1"
            defaultValue={eventRow.expectedAttendance ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save changes
          </button>
          <Link
            href={`/events/${eventId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
