import Link from "next/link";
import { db } from "@/lib/db";
import { heartlinkCohort } from "@/schema/programs";
import { branch } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HeartlinkListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type CohortStatus = "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  const statusValues: CohortStatus[] =
    statusFilter === "all"
      ? ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]
      : statusFilter === "past"
      ? ["COMPLETED", "CANCELLED"]
      : ["PLANNING", "ACTIVE"];

  const cohorts = await db
    .select({
      cohortId: heartlinkCohort.cohortId,
      name: heartlinkCohort.name,
      status: heartlinkCohort.status,
      startsOn: heartlinkCohort.startsOn,
      endsOn: heartlinkCohort.endsOn,
      branchName: branch.name,
    })
    .from(heartlinkCohort)
    .leftJoin(branch, eq(heartlinkCohort.branchId, branch.branchId))
    .where(inArray(heartlinkCohort.status, statusValues))
    .orderBy(desc(heartlinkCohort.cohortId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Heartlink Cohorts</h1>
        <Link
          href="/programs/heartlink/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New cohort
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {(["active", "past", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/programs/heartlink?status=${s}`}
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

      {cohorts.length === 0 ? (
        <p className="text-gray-500 text-sm">No cohorts found.</p>
      ) : (
        <div className="space-y-2">
          {cohorts.map((c) => (
            <Link
              key={c.cohortId}
              href={`/programs/heartlink/${c.cohortId}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.branchName}</p>
                </div>
                <span className="text-xs text-gray-500 uppercase">{c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
