// app/src/app/(admin)/education/bc/students/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcCohort, bcProgram } from "@/schema/education";
import { eq } from "drizzle-orm";
import { registerBcStudent } from "@/actions/education-bc";

export default async function RegisterBcStudentPage() {
  const cohorts = await db
    .select({
      cohortId: bcCohort.cohortId,
      name: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcCohort)
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    .orderBy(bcCohort.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Register student</h1>
      </div>
      <form action={(fd) => void registerBcStudent(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person ID <span className="text-red-500">*</span>
          </label>
          <input name="personId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cohort <span className="text-red-500">*</span>
          </label>
          <select name="cohortId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select cohort…</option>
            {cohorts.map((c) => (
              <option key={c.cohortId} value={c.cohortId}>{c.programName} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Student number <span className="text-red-500">*</span>
          </label>
          <input name="studentNumber" type="text" required placeholder="BC-2026-001"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
          <Link href="/education/bc/students"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
