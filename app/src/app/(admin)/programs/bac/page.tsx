import Link from "next/link";
import { db } from "@/lib/db";
import { bacInitiative } from "@/schema/missions";
import { branch } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BacListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type InitiativeStatus = "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  const statusValues: InitiativeStatus[] =
    statusFilter === "all"
      ? ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]
      : statusFilter === "past"
      ? ["COMPLETED", "CANCELLED"]
      : ["PLANNING", "ACTIVE"];

  const initiatives = await db
    .select({
      initiativeId: bacInitiative.initiativeId,
      name: bacInitiative.name,
      status: bacInitiative.status,
      startsOn: bacInitiative.startsOn,
      endsOn: bacInitiative.endsOn,
      branchName: branch.name,
    })
    .from(bacInitiative)
    .leftJoin(branch, eq(bacInitiative.branchId, branch.branchId))
    .where(inArray(bacInitiative.status, statusValues))
    .orderBy(desc(bacInitiative.initiativeId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">BAC Initiatives</h1>
        <Link
          href="/programs/bac/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New initiative
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {(["active", "past", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/programs/bac?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {initiatives.length === 0 ? (
        <p className="text-gray-500 text-sm">No initiatives found.</p>
      ) : (
        <div className="space-y-2">
          {initiatives.map((i) => (
            <Link
              key={i.initiativeId}
              href={`/programs/bac/${i.initiativeId}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{i.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{i.branchName}</p>
                </div>
                <span className="text-xs text-gray-500 uppercase">{i.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
