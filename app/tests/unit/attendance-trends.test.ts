import { describe, it, expect } from "vitest";
import {
  aggregateWeekly,
  trendTotals,
  type WeeklySummaryInput,
} from "@/lib/attendance-trends";

describe("aggregateWeekly", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateWeekly([])).toEqual([]);
  });

  it("passes through a single week", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: 50, unique_persons: 40, ftv_count: 3 },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 50, uniquePersons: 40, ftv: 3 },
    ]);
  });

  it("sums multiple events in the same week", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: 50, unique_persons: 40, ftv_count: 3 },
      { week_start: "2026-06-01", total_check_ins: 20, unique_persons: 18, ftv_count: 1 },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 70, uniquePersons: 58, ftv: 4 },
    ]);
  });

  it("sorts weeks ascending regardless of input order", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-08", total_check_ins: 10, unique_persons: 10, ftv_count: 0 },
      { week_start: "2026-06-01", total_check_ins: 5, unique_persons: 5, ftv_count: 0 },
    ];
    expect(aggregateWeekly(rows).map((b) => b.week)).toEqual([
      "2026-06-01",
      "2026-06-08",
    ]);
  });

  it("treats null counts as zero", () => {
    const rows: WeeklySummaryInput[] = [
      { week_start: "2026-06-01", total_check_ins: null, unique_persons: null, ftv_count: null },
    ];
    expect(aggregateWeekly(rows)).toEqual([
      { week: "2026-06-01", checkIns: 0, uniquePersons: 0, ftv: 0 },
    ]);
  });
});

describe("trendTotals", () => {
  it("returns zeros for no buckets (no divide-by-zero)", () => {
    expect(trendTotals([])).toEqual({ totalCheckIns: 0, totalFtv: 0, avgPerWeek: 0 });
  });

  it("computes totals and rounded average", () => {
    const buckets = [
      { week: "2026-06-01", checkIns: 70, uniquePersons: 58, ftv: 4 },
      { week: "2026-06-08", checkIns: 31, uniquePersons: 30, ftv: 1 },
    ];
    expect(trendTotals(buckets)).toEqual({
      totalCheckIns: 101,
      totalFtv: 5,
      avgPerWeek: 51, // round(101/2)
    });
  });
});
