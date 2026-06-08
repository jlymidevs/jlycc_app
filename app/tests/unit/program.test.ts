// app/tests/unit/program.test.ts
import { describe, it, expect } from "vitest";
import {
  createCohortSchema,
  updateCohortSchema,
  enrollPersonSchema,
  createHeartlinkSessionSchema,
} from "@/lib/validations/program";

describe("createCohortSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createCohortSchema.safeParse({
      branchId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = createCohortSchema.safeParse({
      name: "",
      branchId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid branchId zero", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative branchId", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date string for startsOn", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 1,
      startsOn: "not-a-date",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("startsOn");
  });

  it("accepts valid date for startsOn", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 1,
      startsOn: "2024-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid status enum values", () => {
    const statuses = ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"];
    statuses.forEach((status) => {
      const result = createCohortSchema.safeParse({
        name: "Cohort A",
        branchId: 1,
        status,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid status value", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 1,
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createCohortSchema.safeParse({
      name: "Cohort A",
      branchId: 1,
      startsOn: "2024-06-01",
      endsOn: "2024-08-31",
      sessionCount: 12,
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateCohortSchema", () => {
  it("accepts empty object (no-op update)", () => {
    const result = updateCohortSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial object with just name", () => {
    const result = updateCohortSchema.safeParse({
      name: "Updated Cohort",
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial object with just branchId", () => {
    const result = updateCohortSchema.safeParse({
      branchId: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial object with status", () => {
    const result = updateCohortSchema.safeParse({
      status: "COMPLETED",
    });
    expect(result.success).toBe(true);
  });
});

describe("enrollPersonSchema", () => {
  it("accepts valid personId", () => {
    const result = enrollPersonSchema.safeParse({
      personId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing personId", () => {
    const result = enrollPersonSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects personId zero", () => {
    const result = enrollPersonSchema.safeParse({
      personId: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative personId", () => {
    const result = enrollPersonSchema.safeParse({
      personId: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer personId", () => {
    const result = enrollPersonSchema.safeParse({
      personId: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("createHeartlinkSessionSchema", () => {
  it("accepts valid minimal input with sessionNumber", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sessionNumber", () => {
    const result = createHeartlinkSessionSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("sessionNumber");
  });

  it("rejects sessionNumber zero", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sessionNumber", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sessionNumber", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 1,
      topic: "Introduction to Heartlink",
      scheduledAt: "2024-06-15T19:00:00+08:00",
      durationMinutes: 120,
      venue: "Church Hall",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid datetime format for scheduledAt", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 1,
      scheduledAt: "not-a-datetime",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("scheduledAt");
  });

  it("accepts valid datetime with offset for scheduledAt", () => {
    const result = createHeartlinkSessionSchema.safeParse({
      sessionNumber: 1,
      scheduledAt: "2024-06-15T19:00:00+08:00",
    });
    expect(result.success).toBe(true);
  });
});
