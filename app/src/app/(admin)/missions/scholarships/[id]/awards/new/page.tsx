// app/src/app/(admin)/missions/scholarships/[id]/awards/new/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { scholarProgram } from "@/schema/missions";
import { eq } from "drizzle-orm";
import { createAward } from "@/actions/scholarship";

export default async function NewAwardPage({ params }: { params: { id: string } }) {
  const programId = Number(params.id);

  const [program] = await db
    .select({ programId: scholarProgram.programId, name: scholarProgram.name })
    .from(scholarProgram)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  if (!program) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/missions/scholarships/${programId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {program.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add award</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={createAward.bind(null, programId) as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member ID <span className="text-red-500">*</span>
          </label>
          <input name="memberId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School name</label>
          <input name="schoolName" type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <input name="term" type="text" placeholder="AY 2026-2027"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
            <input name="amount" type="number" step="0.01" min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor Member ID</label>
          <input name="sponsorMemberId" type="number" min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="AWARDED">Awarded</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add award
          </button>
          <Link href={`/missions/scholarships/${programId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
