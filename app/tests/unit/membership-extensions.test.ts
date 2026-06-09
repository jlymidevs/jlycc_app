// app/tests/unit/membership-extensions.test.ts
import { describe, it, expect } from "vitest";
import {
  submitApplicationSchema,
  reviewApplicationSchema,
  assignRoleSchema,
  endRoleSchema,
  assignPcmSchema,
  endPcmSchema,
} from "@/lib/validations/membership-extensions";

describe("submitApplicationSchema", () => {
  it("accepts valid memberId", () => {
    const result = submitApplicationSchema.safeParse({ memberId: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing memberId", () => {
    const result = submitApplicationSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("memberId");
  });

  it("rejects non-positive memberId", () => {
    const result = submitApplicationSchema.safeParse({ memberId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative memberId", () => {
    const result = submitApplicationSchema.safeParse({ memberId: -1 });
    expect(result.success).toBe(false);
  });
});

describe("reviewApplicationSchema", () => {
  it("accepts valid APPROVED with notes", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 1,
      status: "APPROVED",
      decisionNotes: "Approved by staff",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid WITHDRAWN without notes", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 2,
      status: "WITHDRAWN",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid REJECTED with notes", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 3,
      status: "REJECTED",
      decisionNotes: "Does not meet criteria",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status PENDING", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 1,
      status: "PENDING",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing applicationId", () => {
    const result = reviewApplicationSchema.safeParse({
      status: "APPROVED",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("applicationId");
  });

  it("rejects non-positive applicationId", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 0,
      status: "APPROVED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = reviewApplicationSchema.safeParse({
      applicationId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("status");
  });
});

describe("assignRoleSchema", () => {
  it("accepts valid input", () => {
    const result = assignRoleSchema.safeParse({
      memberId: 1,
      roleId: 5,
      assignedAt: "2026-06-09",
      notes: "Assigned to leadership",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without optional notes", () => {
    const result = assignRoleSchema.safeParse({
      memberId: 1,
      roleId: 5,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = assignRoleSchema.safeParse({
      memberId: 1,
      roleId: 5,
      assignedAt: "06-09-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing roleId", () => {
    const result = assignRoleSchema.safeParse({
      memberId: 1,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("roleId");
  });

  it("rejects non-positive roleId", () => {
    const result = assignRoleSchema.safeParse({
      memberId: 1,
      roleId: 0,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing memberId", () => {
    const result = assignRoleSchema.safeParse({
      roleId: 5,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("memberId");
  });
});

describe("endRoleSchema", () => {
  it("accepts valid input", () => {
    const result = endRoleSchema.safeParse({
      memberRoleId: 1,
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = endRoleSchema.safeParse({
      memberRoleId: 1,
      endedAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing memberRoleId", () => {
    const result = endRoleSchema.safeParse({
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("memberRoleId");
  });

  it("rejects non-positive memberRoleId", () => {
    const result = endRoleSchema.safeParse({
      memberRoleId: -1,
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
  });
});

describe("assignPcmSchema", () => {
  it("accepts valid input", () => {
    const result = assignPcmSchema.safeParse({
      carerMemberId: 10,
      assignedMemberId: 20,
      assignedAt: "2026-06-09",
      notes: "Primary care assignment",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without optional notes", () => {
    const result = assignPcmSchema.safeParse({
      carerMemberId: 10,
      assignedMemberId: 20,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing carerMemberId", () => {
    const result = assignPcmSchema.safeParse({
      assignedMemberId: 20,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("carerMemberId");
  });

  it("rejects non-positive carerMemberId", () => {
    const result = assignPcmSchema.safeParse({
      carerMemberId: 0,
      assignedMemberId: 20,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = assignPcmSchema.safeParse({
      carerMemberId: 10,
      assignedMemberId: 20,
      assignedAt: "2026/06/09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing assignedMemberId", () => {
    const result = assignPcmSchema.safeParse({
      carerMemberId: 10,
      assignedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("assignedMemberId");
  });
});

describe("endPcmSchema", () => {
  it("accepts valid input", () => {
    const result = endPcmSchema.safeParse({
      assignmentId: 5,
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = endPcmSchema.safeParse({
      assignmentId: 5,
      endedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing assignmentId", () => {
    const result = endPcmSchema.safeParse({
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("assignmentId");
  });

  it("rejects non-positive assignmentId", () => {
    const result = endPcmSchema.safeParse({
      assignmentId: 0,
      endedAt: "2026-06-09",
    });
    expect(result.success).toBe(false);
  });
});
