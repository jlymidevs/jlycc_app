import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { heartlinkCohort } from "@/schema/programs";
import { branch } from "@/schema/core";
import { eq } from "drizzle-orm";
import { updateCohort } from "@/actions/programs";

export default async function EditCohortPage({ params }: { params: { id: string } }) {
  const cohortId = Number(params.id);
  const [cohort] = await db
    .select({
      cohortId: heartlinkCohort.cohortId,
      name: heartlinkCohort.name,
      status: heartlinkCohort.status,
      startsOn: heartlinkCohort.startsOn,
      endsOn: heartlinkCohort.endsOn,
      sessionCount: heartlinkCohort.sessionCount,
    })
    .from(heartlinkCohort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkCohort.cohortId, cohortId as any));

  if (!cohort) notFound();

  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/programs/heartlink/${cohortId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Cohort
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit cohort</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={updateCohort.bind(null, cohortId) as any} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input name="name" type="text" required defaultValue={cohort.name} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status" defaultValue={cohort.status} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {["PLANNING","ACTIVE","COMPLETED","CANCELLED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts on</label>
            <input name="startsOn" type="date" defaultValue={cohort.startsOn ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends on</label>
            <input name="endsOn" type="date" defaultValue={cohort.endsOn ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save changes
          </button>
          <Link href={`/programs/heartlink/${cohortId}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
