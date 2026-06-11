// app/src/lib/attendance-trends.ts
// Pure aggregation helpers for the attendance trend dashboard.

export type WeeklySummaryInput = {
  week_start: string;
  total_check_ins: number | null;
  unique_persons: number | null;
  ftv_count: number | null;
};

export type WeeklyBucket = {
  week: string;
  checkIns: number;
  uniquePersons: number;
  ftv: number;
};

export function aggregateWeekly(rows: WeeklySummaryInput[]): WeeklyBucket[] {
  const byWeek = new Map<string, WeeklyBucket>();
  for (const row of rows) {
    const bucket = byWeek.get(row.week_start) ?? {
      week: row.week_start,
      checkIns: 0,
      uniquePersons: 0,
      ftv: 0,
    };
    bucket.checkIns += Number(row.total_check_ins ?? 0);
    bucket.uniquePersons += Number(row.unique_persons ?? 0);
    bucket.ftv += Number(row.ftv_count ?? 0);
    byWeek.set(row.week_start, bucket);
  }
  const result: WeeklyBucket[] = [];
  byWeek.forEach((bucket) => result.push(bucket));
  return result.sort((a, b) => a.week.localeCompare(b.week));
}

export function trendTotals(buckets: WeeklyBucket[]): {
  totalCheckIns: number;
  totalFtv: number;
  avgPerWeek: number;
} {
  const totalCheckIns = buckets.reduce((sum, b) => sum + b.checkIns, 0);
  const totalFtv = buckets.reduce((sum, b) => sum + b.ftv, 0);
  const avgPerWeek =
    buckets.length === 0 ? 0 : Math.round(totalCheckIns / buckets.length);
  return { totalCheckIns, totalFtv, avgPerWeek };
}
