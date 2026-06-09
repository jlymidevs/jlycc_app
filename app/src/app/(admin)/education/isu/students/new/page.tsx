// app/src/app/(admin)/education/isu/students/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuTrack } from "@/schema/education";
import { registerIsuStudent } from "@/actions/education-isu";

export default async function RegisterIsuStudentPage() {
  const tracks = await db
    .select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
    .from(isuTrack)
    .orderBy(isuTrack.orderIndex);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/isu/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Register ISU student</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={registerIsuStudent as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person ID <span className="text-red-500">*</span>
          </label>
          <input name="personId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Starting track</label>
          <select name="currentTrackId"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">None (assign later)</option>
            {tracks.map((t) => (
              <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enrolled on <span className="text-red-500">*</span>
          </label>
          <input name="enrolledOn" type="date" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Register student
          </button>
          <Link href="/education/isu/students"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
