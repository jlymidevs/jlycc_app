// app/tests/unit/month-grid.test.ts
import { describe, it, expect } from "vitest";
import {
  parseMonthParam,
  monthGridDays,
  monthRangeUtc,
  manilaDateOf,
  currentManilaMonth,
} from "@/lib/month-grid";

describe("currentManilaMonth", () => {
  it("returns YYYY-MM format", () => {
    expect(currentManilaMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});

describe("parseMonthParam", () => {
  it("parses valid month", () => {
    expect(parseMonthParam("2026-06")).toEqual({ year: 2026, month: 6 });
  });

  it("falls back to current month for garbage", () => {
    const current = currentManilaMonth();
    const expected = {
      year: Number(current.slice(0, 4)),
      month: Number(current.slice(5, 7)),
    };
    expect(parseMonthParam("not-a-month")).toEqual(expected);
    expect(parseMonthParam("2026-13")).toEqual(expected);
    expect(parseMonthParam(undefined)).toEqual(expected);
  });
});

describe("monthGridDays", () => {
  it("returns 42 cells starting on Sunday", () => {
    const cells = monthGridDays(2026, 6); // June 2026 starts Monday
    expect(cells).toHaveLength(42);
    expect(cells[0].date).toBe("2026-05-31"); // Sunday before June 1
    expect(cells[1].date).toBe("2026-06-01");
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].inMonth).toBe(true);
  });

  it("marks out-of-month trailing cells", () => {
    const cells = monthGridDays(2026, 6);
    const last = cells[41];
    expect(last.date).toBe("2026-07-11");
    expect(last.inMonth).toBe(false);
  });
});

describe("monthRangeUtc", () => {
  it("returns Manila month boundaries in UTC", () => {
    const { start, end } = monthRangeUtc(2026, 6);
    // June 1 00:00 Manila = May 31 16:00 UTC
    expect(start.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    // July 1 00:00 Manila = June 30 16:00 UTC
    expect(end.toISOString()).toBe("2026-06-30T16:00:00.000Z");
  });
});

describe("manilaDateOf", () => {
  it("buckets a UTC instant into its Manila calendar date", () => {
    // June 13 22:00 UTC = June 14 06:00 Manila
    expect(manilaDateOf(new Date("2026-06-13T22:00:00.000Z"))).toBe(
      "2026-06-14"
    );
    expect(manilaDateOf(new Date("2026-06-14T01:00:00.000Z"))).toBe(
      "2026-06-14"
    );
  });
});
