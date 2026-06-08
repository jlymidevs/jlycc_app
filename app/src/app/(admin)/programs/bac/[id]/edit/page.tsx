import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bacInitiative } from "@/schema/missions";
import { branch } from "@/schema/core";
import { eq } from "drizzle-orm";
import { updateInitiative } from "@/actions/bac";

export default async function EditInitiativePage({ params }: { params: { id: string } }) {
  const initiativeId = Number(params.id);
  const [initiative] = await db
    .select({
      initiativeId: bacInitiative.initiativeId,
      name: bacInitiative.name,
      status: bacInitiative.status,
      startsOn: bacInitiative.startsOn,
      endsOn: bacInitiative.endsOn,
      targetCommunity: bacInitiative.targetCommunity,
      branchId: bacInitiative.branchId,
    })
    .from(bacInitiative)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bacInitiative.initiativeId, initiativeId as any));

  if (!initiative) notFound();

  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/programs/bac/${initiativeId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Initiative
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit initiative</h1>
      </div>
      <form action={(fd) => void updateInitiative(initiativeId, fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input name="name" type="text" required defaultValue={initiative.name} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
          <select name="branchId" required defaultValue={initiative.branchId ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status" defaultValue={initiative.status} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target community</label>
          <input name="targetCommunity" type="text" defaultValue={initiative.targetCommunity ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts on</label>
            <input name="startsOn" type="date" defaultValue={initiative.startsOn ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends on</label>
            <input name="endsOn" type="date" defaultValue={initiative.endsOn ?? ""} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save changes
          </button>
          <Link href={`/programs/bac/${initiativeId}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
