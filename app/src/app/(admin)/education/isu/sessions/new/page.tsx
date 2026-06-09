// app/src/app/(admin)/education/isu/sessions/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuTrack } from "@/schema/education";
import { branch } from "@/schema/core";
import { createIsuSession } from "@/actions/education-isu";

export default async function NewIsuSessionPage() {
  const [tracks, branches] = await Promise.all([
    db.select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
      .from(isuTrack).orderBy(isuTrack.orderIndex),
    db.select({ branchId: branch.branchId, name: branch.name })
      .from(branch).orderBy(branch.name),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/isu/sessions" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Sessions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New ISU session</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createIsuSession as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch <span className="text-red-500">*</span>
          </label>
          <select name="branchId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Track <span className="text-red-500">*</span>
          </label>
          <select name="trackId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select track…</option>
            {tracks.map((t) => (
              <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
          <input name="topic" type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled at</label>
          <input name="scheduledAt" type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create session
          </button>
          <Link href="/education/isu/sessions"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
