// app/tests/unit/account.test.ts
import { describe, it, expect } from "vitest";
import { signupSchema, joinRequestSchema } from "@/lib/validations/account";

const validSignup = {
  firstName: "Maria",
  lastName: "Santos",
  email: "maria@example.com",
  password: "s3cretpass",
  chapterId: 5,
};

describe("signupSchema", () => {
  it("accepts valid signup", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("accepts signup without chapter (no heads exist yet)", () => {
    const { chapterId: _omit, ...rest } = validSignup;
    expect(signupSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects short password", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, password: "short" }).success
    ).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, email: "nope" }).success
    ).toBe(false);
  });

  it("rejects empty names", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, firstName: "" }).success
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...validSignup, lastName: "" }).success
    ).toBe(false);
  });
});

describe("joinRequestSchema", () => {
  it("accepts valid request", () => {
    expect(
      joinRequestSchema.safeParse({ chapterId: 3, priority: 2 }).success
    ).toBe(true);
  });

  it("rejects priority below 1", () => {
    expect(
      joinRequestSchema.safeParse({ chapterId: 3, priority: 0 }).success
    ).toBe(false);
  });

  it("rejects missing chapter", () => {
    expect(joinRequestSchema.safeParse({ priority: 1 }).success).toBe(false);
  });
});
