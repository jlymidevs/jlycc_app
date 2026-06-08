import { describe, it, expect } from "vitest";
import { checkInSchema, captureVisitorSchema } from "@/lib/validations/attendance";

describe("checkInSchema", () => {
  it("accepts valid input", () => {
    const result = checkInSchema.safeParse({ eventId: 1, personId: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects missing eventId", () => {
    const result = checkInSchema.safeParse({ personId: 42 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("eventId");
  });

  it("rejects missing personId", () => {
    const result = checkInSchema.safeParse({ eventId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects non-positive eventId", () => {
    const result = checkInSchema.safeParse({ eventId: 0, personId: 1 });
    expect(result.success).toBe(false);
  });
});

describe("captureVisitorSchema", () => {
  it("accepts valid full input", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
      consentToContact: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = captureVisitorSchema.safeParse({
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("firstName");
  });

  it("rejects missing lastName", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("lastName");
  });

  it("rejects missing birthday", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("birthday");
  });

  it("rejects invalid email", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("defaults consentToContact to false", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consentToContact).toBe(false);
    }
  });

  it("accepts optional invitedByPersonId", () => {
    const result = captureVisitorSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      birthday: "1995-03-15",
      email: "maria@example.com",
      invitedByPersonId: 7,
    });
    expect(result.success).toBe(true);
  });
});
