// app/src/app/(admin)/events/attendance/page.tsx
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SummaryRow = {
  event_id: number;
  event_name: string;
  branch_id: number;
  branch_name: string;
  week_start: string;
  total_check_ins: number;
  unique_persons: number;
  ftv_count: number;
};

export default async function AttendanceDashboardPage({
  searchParams,
}: {
  searchParams: { branchId?: string; range?: string };
}) {
  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  const selectedBranchId = searchParams.branchId
    ? Number(searchParams.branchId)
    : null;
  const range = searchParams.range ?? "month";

  const weekOffset = range === "week" ? 7 : range === "month" ? 30 : 365;
  const since = new Date();
  since.setDate(since.getDate() - weekOffset);
  const sinceStr = since.toISOString().split("T")[0];

  const result = await db.execute(sql`
    SELECT
      s.event_id,
      e.name   AS event_name,
      s.branch_id,
      b.name   AS branch_name,
      s.week_start::text,
      s.total_check_ins,
      s.unique_persons,
      s.ftv_count
    FROM attendance.attendance_summary s
    JOIN events.event    e ON e.event_id   = s.event_id
    JOIN core.branch     b ON b.branch_id  = s.branch_id
    WHERE s.week_start >= ${sinceStr}::date
      ${selectedBranchId ? sql`AND s.branch_id = ${selectedBranchId}` : sql``}
    ORDER BY s.week_start DESC, e.name
    LIMIT 200
  `);

  // postgres.js returns rows directly as an iterable array
  const summary = (Array.isArray(result) ? result : ((result as { rows: unknown[] }).rows ?? [])) as SummaryRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Weekly aggregates across all events</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
          <select
            name="branchId"
            defaultValue={selectedBranchId ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date range</label>
          <select
            name="range"
            defaultValue={range}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      {summary.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance data for the selected filters.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Week of", "Event", "Branch", "Total", "Unique", "FTV"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((row, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 text-sm text-gray-500">{row.week_start}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {row.event_name}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{row.branch_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.total_check_ins}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.unique_persons}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{row.ftv_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
