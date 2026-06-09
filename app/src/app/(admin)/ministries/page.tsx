export const dynamic = "force-dynamic";

import Link from "next/link";
import { getMinistries } from "@/actions/ministries";

export default async function MinistriesPage() {
  const groups = await getMinistries();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>

      {groups.length === 0 ? (
        <p className="text-gray-500 text-sm">No ministries found.</p>
      ) : (
        groups.map((group) => (
          <section key={group.networkId} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-1">
              {group.networkName}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.ministries.map((m) => (
                <Link
                  key={m.ministryId}
                  href={`/ministries/${m.ministryId}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-gray-900">{m.name}</p>
                    <span className="ml-2 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 font-mono">
                      {m.code}
                    </span>
                  </div>
                  {m.targetDemographic && (
                    <p className="mt-1 text-xs text-gray-500">
                      {m.targetDemographic}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
