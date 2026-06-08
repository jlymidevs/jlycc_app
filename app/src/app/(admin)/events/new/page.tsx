// app/src/app/(admin)/events/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { eventType } from "@/schema/events";
import { createEvent } from "@/actions/events";

export default async function NewEventPage() {
  const eventTypes = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-900">
          ← Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add event</h1>
      </div>

      <form action={(fd) => void createEvent(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
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
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type…</option>
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create event
          </button>
          <Link
            href="/events"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
