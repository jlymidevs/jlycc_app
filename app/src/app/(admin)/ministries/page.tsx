// app/src/app/(admin)/ministries/page.tsx
export const dynamic = "force-dynamic";

import { getMinistries } from "@/actions/ministries";
import { getLeadersSidebarData } from "@/actions/ministry-leaders";
import { NetworkTree } from "@/components/ministries/network-tree";
import { LeadersSidebar } from "@/components/ministries/leaders-sidebar";

export default async function MinistriesPage() {
  const [groups, leadersData] = await Promise.all([
    getMinistries(),
    getLeadersSidebarData(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Ministries</h1>

      <div className="flex gap-8 items-start">
        {/* Left: Network + ministry tree */}
        <div className="flex-1 min-w-0">
          <NetworkTree groups={groups} />
        </div>

        {/* Right: Sticky leaders panel */}
        <div className="w-72 flex-shrink-0 sticky top-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <LeadersSidebar data={leadersData} />
        </div>
      </div>
    </div>
  );
}
