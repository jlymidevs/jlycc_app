import { z } from "zod";

export const createCohortSchema = z.object({
  name: z.string().min(1, "Name is required"),
  branchId: z.number().int().positive("Branch is required"),
  startsOn: z.string().date().optional(),
  endsOn: z.string().date().optional(),
  sessionCount: z.number().int().positive().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const updateCohortSchema = createCohortSchema.partial();

export const enrollPersonSchema = z.object({
  personId: z.number().int().positive("Person is required"),
});

export const createHeartlinkSessionSchema = z.object({
  sessionNumber: z.number().int().positive("Session number is required"),
  topic: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().positive().optional(),
  venue: z.string().optional(),
});

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
export type EnrollPersonInput = z.infer<typeof enrollPersonSchema>;
export type CreateHeartlinkSessionInput = z.infer<typeof createHeartlinkSessionSchema>;
