import Link from "next/link";
import { enrollPerson } from "@/actions/programs";

export default function EnrollPersonPage({ params }: { params: { id: string } }) {
  const cohortId = Number(params.id);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/programs/heartlink/${cohortId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Cohort
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Enroll person</h1>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form action={enrollPerson.bind(null, cohortId) as any} className="space-y-5">
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
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Enroll
          </button>
          <Link href={`/programs/heartlink/${cohortId}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
