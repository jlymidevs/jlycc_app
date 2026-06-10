// app/src/app/(admin)/events/series/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { eventType } from "@/schema/events";
import { branch } from "@/schema/core";
import { createSeries } from "@/actions/series";
import SeriesPatternFields from "@/components/series-pattern-fields";

export default async function NewSeriesPage() {
  const eventTypes = await db
    .select({ eventTypeId: eventType.eventTypeId, name: eventType.name })
    .from(eventType)
    .orderBy(eventType.name);
  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/events/series"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Recurring series
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New series</h1>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createSeries as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Series name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Sunday Worship Service"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              name="branchId"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SeriesPatternFields />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time <span className="text-red-500">*</span>
            </label>
            <input
              name="time"
              type="time"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              name="durationMinutes"
              type="number"
              min="1"
              required
              defaultValue="120"
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts on <span className="text-red-500">*</span>
            </label>
            <input
              name="startsOn"
              type="date"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ends on
            </label>
            <input
              name="endsOn"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create series
          </button>
          <Link
            href="/events/series"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
