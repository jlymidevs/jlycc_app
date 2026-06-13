// app/src/components/ministries/network-tree.tsx
import Link from "next/link";
import { NetworkGroup } from "@/actions/ministries";
import { DeleteMinistryButton } from "./delete-ministry-button";

export function NetworkTree({
  groups,
  canDeleteMinistries,
}: {
  groups: NetworkGroup[];
  canDeleteMinistries: boolean;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        No ministries found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <details
          key={group.networkId}
          open={group.networkName === "Eagles"}
          className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
            <h2 className="text-base font-bold text-gray-950">
              {group.networkName}
            </h2>
            <span className="text-lg text-gray-500 transition-transform group-open:rotate-180">
              ˅
            </span>
          </summary>

          <div className="border-t border-gray-200">
            {group.ministries.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-500">
                No ministries in this network yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-3">Ministry</th>
                      <th className="px-5 py-3">Leader</th>
                      <th className="px-5 py-3">Inner Core</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.ministries.map((m) => (
                      <tr key={m.ministryId} className="hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <Link
                            href={`/ministries/${m.ministryId}`}
                            className="font-semibold text-gray-950 hover:text-lime-700"
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {m.headName ? (
                            <span className="font-medium text-gray-800">
                              {m.headName}
                            </span>
                          ) : (
                            <span className="italic text-gray-500">Vacant</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-800">
                          {m.innerCoreCount}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/ministries/${m.ministryId}`}
                              className="rounded-lg px-2 py-1 text-sm font-semibold text-lime-700 hover:bg-lime-50"
                            >
                              + Appoint
                            </Link>
                            {canDeleteMinistries ? (
                              <DeleteMinistryButton ministryId={m.ministryId} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
