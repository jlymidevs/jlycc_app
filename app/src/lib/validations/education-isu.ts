// app/src/lib/validations/education-isu.ts
import { z } from "zod";

export const registerIsuStudentSchema = z.object({
  personId: z.number().int().positive("Person is required"),
  currentTrackId: z.number().int().positive().optional(),
  enrolledOn: z.string().date("Invalid date"),
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]).optional(),
});

export const progressTrackSchema = z.object({
  toTrackId: z.number().int().positive("Track is required"),
  notes: z.string().optional(),
});

export const createIsuSessionSchema = z.object({
  branchId: z.number().int().positive("Branch is required"),
  trackId: z.number().int().positive("Track is required"),
  topic: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: false }).optional(),
});

export type RegisterIsuStudentInput = z.infer<typeof registerIsuStudentSchema>;
export type ProgressTrackInput = z.infer<typeof progressTrackSchema>;
export type CreateIsuSessionInput = z.infer<typeof createIsuSessionSchema>;
