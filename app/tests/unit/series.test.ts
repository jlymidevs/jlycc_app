// app/tests/unit/series.test.ts
import { describe, it, expect } from "vitest";
import { createSeriesSchema } from "@/lib/validations/series";

const validWeekly = {
  name: "Sunday Service",
  eventTypeId: 1,
  recurrencePattern: "WEEKLY" as const,
  startsOn: "2026-06-14",
  config: { dayOfWeek: 0, time: "09:00", durationMinutes: 120, venue: "Main Hall" },
};

describe("createSeriesSchema", () => {
  it("accepts valid weekly series", () => {
    expect(createSeriesSchema.safeParse(validWeekly).success).toBe(true);
  });

  it("accepts valid monthly series", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      recurrencePattern: "MONTHLY",
      config: { dayOfMonth: 1, time: "19:00", durationMinutes: 90 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects weekly series without dayOfWeek", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { time: "09:00", durationMinutes: 120 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects monthly series without dayOfMonth", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      recurrencePattern: "MONTHLY",
      config: { time: "09:00", durationMinutes: 120 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { ...validWeekly.config, time: "9am" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects endsOn before startsOn", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      endsOn: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createSeriesSchema.safeParse({ ...validWeekly, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfWeek out of range", () => {
    const result = createSeriesSchema.safeParse({
      ...validWeekly,
      config: { ...validWeekly.config, dayOfWeek: 7 },
    });
    expect(result.success).toBe(false);
  });
});
