// app/src/lib/validations/education-bc.ts
import { z } from "zod";

export const registerBcStudentSchema = z.object({
  personId: z.number().int().positive("Person is required"),
  cohortId: z.number().int().positive("Cohort is required"),
  studentNumber: z.string().min(1, "Student number is required"),
  enrolledOn: z.string().date("Invalid date"),
  status: z
    .enum(["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"])
    .optional(),
});

export const enrollInOfferingSchema = z.object({
  studentId: z.number().int().positive("Student is required"),
  enrolledOn: z.string().date("Invalid date"),
});

export const recordClassAttendanceSchema = z.object({
  studentId: z.number().int().positive("Student is required"),
  classDate: z.string().date("Invalid date"),
  attended: z.boolean(),
  notes: z.string().optional(),
});

export type RegisterBcStudentInput = z.infer<typeof registerBcStudentSchema>;
export type EnrollInOfferingInput = z.infer<typeof enrollInOfferingSchema>;
export type RecordClassAttendanceInput = z.infer<
  typeof recordClassAttendanceSchema
>;
