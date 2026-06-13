// app/src/components/ministries/network-tree.tsx
import Link from "next/link";
import { NetworkGroup } from "@/actions/ministries";
import { AddMinistryForm } from "./add-ministry-form";
import { DeleteMinistryButton } from "./delete-ministry-button";
import { DeleteNetworkButton } from "./delete-network-button";

export function NetworkTree({ groups }: { groups: NetworkGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        No ministries found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section
          key={group.networkId}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          <div className="flex flex-col gap-1 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {group.networkName}
              </h2>
              <p className="text-xs text-gray-500">
                {group.ministries.length} ministries
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AddMinistryForm networkId={group.networkId} />
              <DeleteNetworkButton
                networkId={group.networkId}
                networkName={group.networkName}
                hasMinistries={group.ministries.length > 0}
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {group.ministries.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                No ministries in this network yet.
              </div>
            ) : (
              group.ministries.map((m) => (
                <div
                  key={m.ministryId}
                  className="group grid gap-3 px-4 py-3 transition-colors hover:bg-lime-50/40 sm:grid-cols-[minmax(0,1fr)_220px_36px] sm:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ministries/${m.ministryId}`}
                      className="block truncate text-sm font-semibold text-gray-950 hover:text-lime-700"
                    >
                      {m.name}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">Main chapter</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Ministry Head
                    </p>
                    {m.headName ? (
                      <p className="mt-1 truncate text-sm font-medium text-gray-800">
                        {m.headName}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-amber-700">
                        Vacant
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <DeleteMinistryButton
                      ministryId={m.ministryId}
                      ministryName={m.name}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
