// app/src/components/ministries/network-tree.tsx
import Link from "next/link";
import { NetworkGroup } from "@/actions/ministries";
import { AddMinistryForm } from "./add-ministry-form";
import { CloseMinistryButton } from "./close-ministry-button";

export function NetworkTree({ groups }: { groups: NetworkGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-gray-400">No ministries found.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.networkId} className="space-y-2">
          <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-1">
            {group.networkName}
          </h2>

          <div className="space-y-1">
            {group.ministries.map((m) => (
              <div
                key={m.ministryId}
                className="flex items-start justify-between group rounded-lg px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <Link
                    href={`/ministries/${m.ministryId}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.headName ?? (
                      <span className="italic">Vacant</span>
                    )}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CloseMinistryButton ministryId={m.ministryId} />
                </div>
              </div>
            ))}
          </div>

          <AddMinistryForm networkId={group.networkId} />
        </section>
      ))}
    </div>
  );
}
