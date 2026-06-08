import { z } from "zod";

export const createInitiativeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  branchId: z.number().int().positive("Branch is required"),
  targetCommunity: z.string().optional(),
  startsOn: z.string().date().optional(),
  endsOn: z.string().date().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const updateInitiativeSchema = createInitiativeSchema.partial();

export const addParticipantSchema = z.object({
  personId: z.number().int().positive("Person is required"),
  role: z.enum(["LEADER", "FACILITATOR", "PARTICIPANT", "VOLUNTEER"]).default("PARTICIPANT"),
});

export const createBacSessionSchema = z.object({
  sessionNumber: z.number().int().positive("Session number is required"),
  topic: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().positive().optional(),
  venue: z.string().optional(),
});

export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;
export type UpdateInitiativeInput = z.infer<typeof updateInitiativeSchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;
export type CreateBacSessionInput = z.infer<typeof createBacSessionSchema>;
