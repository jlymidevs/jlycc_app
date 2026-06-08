// app/tests/unit/event.test.ts
import { describe, it, expect } from "vitest";
import {
  createEventSchema,
  updateEventSchema,
  publicRegisterSchema,
} from "@/lib/validations/event";

describe("createEventSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createEventSchema.safeParse({
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = createEventSchema.safeParse({
      name: "",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing eventTypeId", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      startsAt: "2026-06-15T10:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("eventTypeId");
  });

  it("rejects missing startsAt", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("startsAt");
  });

  it("accepts optional venue and expectedAttendance", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
      venue: "Main Hall",
      expectedAttendance: 200,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative expectedAttendance", () => {
    const result = createEventSchema.safeParse({
      name: "Sunday Service",
      eventTypeId: 1,
      startsAt: "2026-06-15T10:00",
      expectedAttendance: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("accepts partial update with just name", () => {
    const result = updateEventSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateEventSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("publicRegisterSchema", () => {
  it("accepts valid name and email", () => {
    const result = publicRegisterSchema.safeParse({
      name: "Maria Santos",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = publicRegisterSchema.safeParse({
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects empty name", () => {
    const result = publicRegisterSchema.safeParse({
      name: "",
      email: "maria@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = publicRegisterSchema.safeParse({
      name: "Maria Santos",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("rejects missing email", () => {
    const result = publicRegisterSchema.safeParse({ name: "Maria Santos" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });
});
