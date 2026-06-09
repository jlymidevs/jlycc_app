import { describe, it, expect } from "vitest";
import {
  createChapterSchema,
  addMemberSchema,
  endMemberSchema,
} from "@/lib/validations/ministries";

describe("createChapterSchema", () => {
  it("accepts valid input with required fields only", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ACTIVE");
    }
  });

  it("accepts valid input with all fields", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
      launchedOn: "2024-01-15",
      status: "PAUSED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing ministryId", () => {
    const result = createChapterSchema.safeParse({ branchId: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("ministryId");
  });

  it("rejects missing branchId", () => {
    const result = createChapterSchema.safeParse({ ministryId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("branchId");
  });

  it("rejects invalid status value", () => {
    const result = createChapterSchema.safeParse({
      ministryId: 1,
      branchId: 2,
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts valid non-leader input", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid leader input with role", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: true,
      leaderRole: "HEAD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects isLeader=true without leaderRole", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("leaderRole");
  });

  it("rejects missing joinedAt", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      isLeader: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("joinedAt");
  });

  it("rejects missing chapterId", () => {
    const result = addMemberSchema.safeParse({
      memberId: 5,
      joinedAt: "2024-03-01",
      isLeader: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("chapterId");
  });

  it("defaults isLeader to false", () => {
    const result = addMemberSchema.safeParse({
      chapterId: 1,
      memberId: 5,
      joinedAt: "2024-03-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isLeader).toBe(false);
    }
  });
});

describe("endMemberSchema", () => {
  it("accepts valid input with reason", () => {
    const result = endMemberSchema.safeParse({
      membershipId: 10,
      endedAt: "2024-06-01",
      endedReason: "Graduated",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input without reason", () => {
    const result = endMemberSchema.safeParse({
      membershipId: 10,
      endedAt: "2024-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing membershipId", () => {
    const result = endMemberSchema.safeParse({ endedAt: "2024-06-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("membershipId");
  });

  it("rejects missing endedAt", () => {
    const result = endMemberSchema.safeParse({ membershipId: 10 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("endedAt");
  });
});
