// app/src/app/(admin)/missions/scholarships/new/page.tsx
import Link from "next/link";
import { createScholarProgram } from "@/actions/scholarship";

export default function NewScholarProgramPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/missions/scholarships" className="text-sm text-gray-500 hover:text-gray-900">
          ← Scholarship Programs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New scholarship program</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createScholarProgram as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Program name <span className="text-red-500">*</span>
          </label>
          <input name="name" type="text" required placeholder="JLY Scholarship 2026"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts on</label>
            <input name="startsOn" type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends on</label>
            <input name="endsOn" type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create program
          </button>
          <Link href="/missions/scholarships"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
