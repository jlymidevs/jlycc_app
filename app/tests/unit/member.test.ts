// app/tests/unit/member.test.ts
import { describe, it, expect } from "vitest";
import {
  createMemberSchema,
  updateMemberSchema,
} from "@/lib/validations/member";

describe("createMemberSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = createMemberSchema.safeParse({
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("firstName");
  });

  it("rejects empty firstName", () => {
    const result = createMemberSchema.safeParse({
      firstName: "",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid joinedAt date", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("joinedAt");
  });

  it("rejects branchId zero", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 0,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      middleName: "Cruz",
      lastName: "Santos",
      gender: "FEMALE",
      email: "maria@example.com",
      mobile: "+639171234567",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      email: "not-an-email",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });
});

describe("updateMemberSchema", () => {
  it("accepts partial update with just stage", () => {
    const result = updateMemberSchema.safeParse({
      currentStage: "OGV",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
