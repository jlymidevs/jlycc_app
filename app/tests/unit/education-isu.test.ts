// app/tests/unit/education-isu.test.ts
import { describe, it, expect } from "vitest";
import {
  registerIsuStudentSchema,
  progressTrackSchema,
  createIsuSessionSchema,
} from "@/lib/validations/education-isu";

describe("registerIsuStudentSchema", () => {
  it("accepts valid input", () => {
    const result = registerIsuStudentSchema.safeParse({
      personId: 1,
      currentTrackId: 2,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without currentTrackId (optional)", () => {
    const result = registerIsuStudentSchema.safeParse({
      personId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing personId", () => {
    const result = registerIsuStudentSchema.safeParse({ enrolledOn: "2026-01-15" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects invalid enrolledOn", () => {
    const result = registerIsuStudentSchema.safeParse({ personId: 1, enrolledOn: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("progressTrackSchema", () => {
  it("accepts valid toTrackId", () => {
    const result = progressTrackSchema.safeParse({ toTrackId: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects missing toTrackId", () => {
    const result = progressTrackSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createIsuSessionSchema", () => {
  it("accepts minimal input", () => {
    const result = createIsuSessionSchema.safeParse({ branchId: 1, trackId: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects missing branchId", () => {
    const result = createIsuSessionSchema.safeParse({ trackId: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("branchId");
  });

  it("rejects missing trackId", () => {
    const result = createIsuSessionSchema.safeParse({ branchId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("trackId");
  });
});
