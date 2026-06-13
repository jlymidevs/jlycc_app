// app/src/app/(admin)/ministries/page.tsx
export const dynamic = "force-dynamic";

import { getMinistries } from "@/actions/ministries";
import { getLeadersSidebarData } from "@/actions/ministry-leaders";
import { NetworkTree } from "@/components/ministries/network-tree";
import { LeadersSidebar } from "@/components/ministries/leaders-sidebar";
import { AddNetworkForm } from "@/components/ministries/add-network-form";

export default async function MinistriesPage() {
  const [groups, leadersData] = await Promise.all([
    getMinistries(),
    getLeadersSidebarData(),
  ]);

  const ministryCount = groups.reduce(
    (count, group) => count + group.ministries.length,
    0
  );
  const vacancyCount = groups.reduce(
    (count, group) =>
      count + group.ministries.filter((ministry) => !ministry.headName).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Ministry Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Ministries</h1>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm sm:min-w-96">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Networks
            </p>
            <p className="mt-1 text-lg font-bold text-gray-950">
              {groups.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Ministries
            </p>
            <p className="mt-1 text-lg font-bold text-gray-950">
              {ministryCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Vacant
            </p>
            <p className="mt-1 text-lg font-bold text-gray-950">
              {vacancyCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <NetworkTree groups={groups} />
          <AddNetworkForm />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <LeadersSidebar data={leadersData} />
        </aside>
      </div>
    </div>
  );
}
