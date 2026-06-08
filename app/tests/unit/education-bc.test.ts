// app/tests/unit/education-bc.test.ts
import { describe, it, expect } from "vitest";
import {
  registerBcStudentSchema,
  enrollInOfferingSchema,
  recordClassAttendanceSchema,
} from "@/lib/validations/education-bc";

describe("registerBcStudentSchema", () => {
  it("accepts valid input", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing personId", () => {
    const result = registerBcStudentSchema.safeParse({
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects missing studentNumber", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("studentNumber");
  });

  it("rejects invalid enrolledOn date", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid status enum values", () => {
    const statuses = ["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"];
    statuses.forEach((status) => {
      const result = registerBcStudentSchema.safeParse({
        personId: 1,
        cohortId: 1,
        studentNumber: "BC-2026-001",
        enrolledOn: "2026-01-15",
        status,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid status value", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
      status: "INVALID_STATUS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects personId zero", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 0,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative personId", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: -1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects cohortId zero", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 0,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty studentNumber", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("enrollInOfferingSchema", () => {
  it("accepts valid input", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing studentId", () => {
    const result = enrollInOfferingSchema.safeParse({
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("studentId");
  });

  it("rejects missing enrolledOn", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("enrolledOn");
  });

  it("rejects invalid enrolledOn date", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: 1,
      enrolledOn: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects studentId zero", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: 0,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative studentId", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: -1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("recordClassAttendanceSchema", () => {
  it("accepts present attendance", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts absent attendance", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing studentId", () => {
    const result = recordClassAttendanceSchema.safeParse({
      classDate: "2026-03-10",
      attended: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("studentId");
  });

  it("rejects missing classDate", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      attended: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("classDate");
  });

  it("rejects missing attended", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("attended");
  });

  it("rejects invalid classDate", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "not-a-date",
      attended: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects studentId zero", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 0,
      classDate: "2026-03-10",
      attended: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative studentId", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: -1,
      classDate: "2026-03-10",
      attended: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: false,
      notes: "Excused absence due to medical appointment",
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-boolean attended value as boolean coercion", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: "true",
    });
    expect(result.success).toBe(false);
  });
});
