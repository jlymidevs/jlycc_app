import { describe, it, expect } from "vitest";
import {
  expandSeriesDates,
  manilaDateTimeToUtc,
} from "@/lib/series-expansion";

describe("manilaDateTimeToUtc", () => {
  it("converts Manila local time to UTC (UTC+8)", () => {
    const d = manilaDateTimeToUtc("2026-06-14", "09:00");
    expect(d.toISOString()).toBe("2026-06-14T01:00:00.000Z");
  });

  it("handles midnight crossing into previous UTC day", () => {
    const d = manilaDateTimeToUtc("2026-06-14", "06:00");
    expect(d.toISOString()).toBe("2026-06-13T22:00:00.000Z");
  });
});

describe("expandSeriesDates — WEEKLY", () => {
  const rule = {
    recurrencePattern: "WEEKLY" as const,
    startsOn: "2026-06-14", // a Sunday
    endsOn: null,
    dayOfWeek: 0, // Sunday
    time: "09:00",
  };

  it("returns every Sunday in range", () => {
    const dates = expandSeriesDates(rule, "2026-06-14", "2026-07-05");
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-06-14T01:00:00.000Z",
      "2026-06-21T01:00:00.000Z",
      "2026-06-28T01:00:00.000Z",
      "2026-07-05T01:00:00.000Z",
    ]);
  });

  it("clamps to startsOn when range starts earlier", () => {
    const dates = expandSeriesDates(rule, "2026-06-01", "2026-06-20");
    expect(dates).toHaveLength(1);
    expect(dates[0].toISOString()).toBe("2026-06-14T01:00:00.000Z");
  });

  it("clamps to endsOn when rule ends inside range", () => {
    const dates = expandSeriesDates(
      { ...rule, endsOn: "2026-06-21" },
      "2026-06-14",
      "2026-07-31"
    );
    expect(dates).toHaveLength(2);
  });

  it("returns empty when endsOn is before range", () => {
    const dates = expandSeriesDates(
      { ...rule, endsOn: "2026-06-20" },
      "2026-07-01",
      "2026-07-31"
    );
    expect(dates).toEqual([]);
  });
});

describe("expandSeriesDates — MONTHLY", () => {
  it("returns matching day each month", () => {
    const dates = expandSeriesDates(
      {
        recurrencePattern: "MONTHLY",
        startsOn: "2026-06-01",
        endsOn: null,
        dayOfMonth: 15,
        time: "19:00",
      },
      "2026-06-01",
      "2026-08-31"
    );
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-06-15T11:00:00.000Z",
      "2026-07-15T11:00:00.000Z",
      "2026-08-15T11:00:00.000Z",
    ]);
  });

  it("skips months without day 31", () => {
    const dates = expandSeriesDates(
      {
        recurrencePattern: "MONTHLY",
        startsOn: "2026-06-01",
        endsOn: null,
        dayOfMonth: 31,
        time: "10:00",
      },
      "2026-06-01",
      "2026-09-30"
    );
    // June 30 days (skip), July 31 ✓, Aug 31 ✓, Sept 30 days (skip)
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-07-31T02:00:00.000Z",
      "2026-08-31T02:00:00.000Z",
    ]);
  });
});
