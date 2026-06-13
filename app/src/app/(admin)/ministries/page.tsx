// app/src/app/(admin)/ministries/page.tsx
export const dynamic = "force-dynamic";

import { getMinistries } from "@/actions/ministries";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/authz";
import { canDeleteMinistries } from "@/lib/ministry-permissions";
import { AddMinistryForm } from "@/components/ministries/add-ministry-form";
import { AddNetworkForm } from "@/components/ministries/add-network-form";
import { NetworkTree } from "@/components/ministries/network-tree";

export default async function MinistriesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MEMBER") as Role;
  const groups = await getMinistries();
  const primaryNetworkId =
    groups.find((group) => group.networkName === "Eagles")?.networkId ??
    groups[0]?.networkId;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-950">Ministries</h1>

        {primaryNetworkId ? (
          <AddMinistryForm networkId={primaryNetworkId} variant="primary" />
        ) : null}
      </div>

      <div className="space-y-4">
        <NetworkTree
          groups={groups}
          canDeleteMinistries={canDeleteMinistries(role)}
        />
        <AddNetworkForm />
      </div>
    </div>
  );
}
