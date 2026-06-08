import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bacInitiative } from "@/schema/missions";
import { eq } from "drizzle-orm";
import { addParticipant } from "@/actions/bac";

export default async function AddParticipantPage({ params }: { params: { id: string } }) {
  const initiativeId = Number(params.id);

  const [initiative] = await db
    .select({ initiativeId: bacInitiative.initiativeId, name: bacInitiative.name })
    .from(bacInitiative)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bacInitiative.initiativeId, initiativeId as any));

  if (!initiative) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/programs/bac/${initiativeId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {initiative.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add participant</h1>
      </div>
      <form action={(fd) => void addParticipant(initiativeId, fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person ID <span className="text-red-500">*</span>
          </label>
          <input
            name="personId"
            type="number"
            required
            min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter person ID"
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add participant
          </button>
          <Link href={`/programs/bac/${initiativeId}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
