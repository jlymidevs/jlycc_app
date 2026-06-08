// app/tests/unit/bac.test.ts
import { describe, it, expect } from "vitest";
import {
  createInitiativeSchema,
  addParticipantSchema,
  createBacSessionSchema,
} from "@/lib/validations/bac";

describe("createInitiativeSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createInitiativeSchema.safeParse({
      branchId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = createInitiativeSchema.safeParse({
      name: "",
      branchId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid branchId zero", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative branchId", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid status enum values", () => {
    const statuses = ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"];
    statuses.forEach((status) => {
      const result = createInitiativeSchema.safeParse({
        name: "Community Health Initiative",
        branchId: 1,
        status,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid status value", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: 1,
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: 1,
      targetCommunity: "Urban neighborhoods",
      startsOn: "2024-06-01",
      endsOn: "2024-12-31",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date string for startsOn", () => {
    const result = createInitiativeSchema.safeParse({
      name: "Community Health Initiative",
      branchId: 1,
      startsOn: "not-a-date",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("startsOn");
  });
});

describe("addParticipantSchema", () => {
  it("accepts valid personId with default role", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("PARTICIPANT");
  });

  it("accepts LEADER role", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
      role: "LEADER",
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("LEADER");
  });

  it("accepts FACILITATOR role", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
      role: "FACILITATOR",
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("FACILITATOR");
  });

  it("accepts PARTICIPANT role", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
      role: "PARTICIPANT",
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("PARTICIPANT");
  });

  it("accepts VOLUNTEER role", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
      role: "VOLUNTEER",
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("VOLUNTEER");
  });

  it("rejects invalid role value", () => {
    const result = addParticipantSchema.safeParse({
      personId: 1,
      role: "INVALID",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("role");
  });

  it("rejects missing personId", () => {
    const result = addParticipantSchema.safeParse({
      role: "LEADER",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects personId zero", () => {
    const result = addParticipantSchema.safeParse({
      personId: 0,
      role: "PARTICIPANT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative personId", () => {
    const result = addParticipantSchema.safeParse({
      personId: -1,
      role: "PARTICIPANT",
    });
    expect(result.success).toBe(false);
  });
});

describe("createBacSessionSchema", () => {
  it("accepts valid minimal input with sessionNumber", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sessionNumber", () => {
    const result = createBacSessionSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("sessionNumber");
  });

  it("rejects sessionNumber zero", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sessionNumber", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sessionNumber", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1,
      topic: "Community Building Activities",
      scheduledAt: "2024-06-15T10:00:00+08:00",
      durationMinutes: 180,
      venue: "Community Center",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid datetime format for scheduledAt", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1,
      scheduledAt: "not-a-datetime",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("scheduledAt");
  });

  it("accepts valid datetime with offset for scheduledAt", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1,
      scheduledAt: "2024-06-15T10:00:00+08:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional topic only", () => {
    const result = createBacSessionSchema.safeParse({
      sessionNumber: 1,
      topic: "Skill Development",
    });
    expect(result.success).toBe(true);
  });
});
