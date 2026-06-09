import { describe, it, expect } from "vitest";
import { createAnnouncementSchema, publishAnnouncementSchema } from "../../src/lib/validations/announcements";

describe("createAnnouncementSchema", () => {
  it("accepts valid ALL_MEMBERS input without targetId", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Sunday Service",
      body: "Join us this Sunday!",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid BRANCH input with targetId", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Branch Meeting",
      body: "Branch meeting details here.",
      targetType: "BRANCH",
      targetId: "branch-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid LIFECYCLE_STAGE input with targetId", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "New Members",
      body: "Welcome to the church family!",
      targetType: "LIFECYCLE_STAGE",
      targetId: "stage-new",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "",
      body: "Some body text",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required");
    }
  });

  it("rejects title over 200 chars", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "a".repeat(201),
      body: "Some body text",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title must be 200 characters or less");
    }
  });

  it("rejects empty body", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Valid Title",
      body: "",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Body is required");
    }
  });

  it("rejects body over 5000 chars", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Valid Title",
      body: "a".repeat(5001),
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Body must be 5000 characters or less");
    }
  });

  it("rejects invalid targetType", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Valid Title",
      body: "Some body text",
      targetType: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("allows missing targetId for ALL_MEMBERS", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "All Members Note",
      body: "This is for everyone.",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetId).toBeUndefined();
    }
  });

  it("allows targetId for BRANCH", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Branch Note",
      body: "For this branch.",
      targetType: "BRANCH",
      targetId: "some-branch",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetId).toBe("some-branch");
    }
  });

  it("title of exactly 200 chars passes", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "a".repeat(200),
      body: "Some body text",
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(true);
  });

  it("body of exactly 5000 chars passes", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Valid Title",
      body: "a".repeat(5000),
      targetType: "ALL_MEMBERS",
    });
    expect(result.success).toBe(true);
  });
});

describe("publishAnnouncementSchema", () => {
  it("accepts positive integer", () => {
    const result = publishAnnouncementSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects zero", () => {
    const result = publishAnnouncementSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative", () => {
    const result = publishAnnouncementSchema.safeParse({ id: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer (1.5)", () => {
    const result = publishAnnouncementSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });
});
