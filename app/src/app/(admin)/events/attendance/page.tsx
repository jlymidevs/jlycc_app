// app/src/app/(admin)/events/attendance/page.tsx
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { sql } from "drizzle-orm";
import { aggregateWeekly, trendTotals } from "@/lib/attendance-trends";
import TrendChart from "@/components/trend-chart";

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

  const buckets = aggregateWeekly(summary);
  const totals = trendTotals(buckets);

  const rangeLabel =
    range === "week" ? "last 7 days" : range === "month" ? "last 30 days" : "last 365 days";

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">Weekly aggregates across all events</p>
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <select
            name="branchId"
            defaultValue={selectedBranchId ?? ""}
            className="input-dark !w-auto !py-2 text-sm"
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            name="range"
            defaultValue={range}
            className="input-dark !w-auto !py-2 text-sm"
            aria-label="Date range"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
          <button type="submit" className="btn-accent !py-2 !px-5">
            Filter
          </button>
        </form>
      </div>

      {buckets.length === 0 ? (
        <div className="card reveal d-1 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No attendance data for the selected filters.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-lime reveal d-1 card-hover px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                Total check-ins
              </p>
              <p className="stat-number mt-2 text-4xl">{totals.totalCheckIns}</p>
              <p className="mt-1 text-xs font-medium opacity-70">{rangeLabel}</p>
            </div>
            <div className="card reveal d-2 card-hover px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Avg per week
              </p>
              <p className="stat-number mt-2 text-4xl text-gray-900">{totals.avgPerWeek}</p>
              <p className="mt-1 text-xs font-medium text-gray-400">{rangeLabel}</p>
            </div>
            <div className="card reveal d-3 card-hover px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                First-time visitors
              </p>
              <p className="stat-number mt-2 text-4xl text-gray-900">{totals.totalFtv}</p>
              <p className="mt-1 text-xs font-medium text-gray-400">{rangeLabel}</p>
            </div>
          </div>

          {/* Weekly trend */}
          <div className="card reveal d-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Weekly trend</h2>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: "var(--chart-1)" }}
                  />
                  Check-ins
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: "var(--chart-2)" }}
                  />
                  First-time visitors
                </span>
              </div>
            </div>
            <TrendChart buckets={buckets} />
          </div>
        </>
      )}

      {/* Table */}
      {summary.length > 0 && (
        <div className="card reveal d-5 overflow-hidden">
          <table className="table-dark min-w-full">
            <thead>
              <tr>
                {["Week of", "Event", "Branch", "Total", "Unique", "FTV"].map((h) => (
                  <th key={h} className="text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => (
                <tr key={i}>
                  <td className="text-gray-500">{row.week_start}</td>
                  <td className="font-medium">{row.event_name}</td>
                  <td className="text-gray-500">{row.branch_name}</td>
                  <td>{row.total_check_ins}</td>
                  <td>{row.unique_persons}</td>
                  <td>{row.ftv_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
