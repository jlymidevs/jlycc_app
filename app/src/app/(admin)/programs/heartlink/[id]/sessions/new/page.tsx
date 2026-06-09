import Link from "next/link";
import { createHeartlinkSession } from "@/actions/programs";

export default function NewHeartlinkSessionPage({ params }: { params: { id: string } }) {
  const cohortId = Number(params.id);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/programs/heartlink/${cohortId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Cohort
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add session</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createHeartlinkSession.bind(null, cohortId) as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session number <span className="text-red-500">*</span></label>
          <input name="sessionNumber" type="number" required min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
          <input name="topic" type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled at</label>
            <input name="scheduledAt" type="datetime-local" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
            <input name="durationMinutes" type="number" min="1" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
          <input name="venue" type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add session
          </button>
          <Link href={`/programs/heartlink/${cohortId}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
