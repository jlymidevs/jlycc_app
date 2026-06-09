// app/tests/unit/scholarship.test.ts
import { describe, it, expect } from "vitest";
import {
  createScholarProgramSchema,
  updateScholarProgramSchema,
  createAwardSchema,
} from "@/lib/validations/scholarship";

describe("createScholarProgramSchema", () => {
  it("accepts valid input", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "JLY Scholarship 2026",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "JLY Scholarship 2026",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      description: "Annual scholarship",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createScholarProgramSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects invalid status", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "Test",
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid startsOn date", () => {
    const result = createScholarProgramSchema.safeParse({
      name: "Test",
      startsOn: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateScholarProgramSchema", () => {
  it("accepts partial update", () => {
    const result = updateScholarProgramSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateScholarProgramSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createAwardSchema", () => {
  it("accepts minimal input", () => {
    const result = createAwardSchema.safeParse({ memberId: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = createAwardSchema.safeParse({
      memberId: 1,
      term: "AY 2026-2027",
      amount: "5000.00",
      schoolName: "UP Manila",
      sponsorMemberId: 2,
      status: "ACTIVE",
      notes: "Full scholarship",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing memberId", () => {
    const result = createAwardSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("memberId");
  });

  it("rejects invalid status", () => {
    const result = createAwardSchema.safeParse({ memberId: 1, status: "PENDING" });
    expect(result.success).toBe(false);
  });
});
