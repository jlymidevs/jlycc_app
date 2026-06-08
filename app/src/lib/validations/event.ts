// app/src/lib/validations/event.ts
import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().min(1, "Event name required"),
  eventTypeId: z.number().int().positive("Event type required"),
  startsAt: z.string().min(1, "Start date/time required"),
  endsAt: z.string().optional(),
  venue: z.string().optional(),
  expectedAttendance: z.number().int().positive().optional(),
  seriesId: z.number().int().positive().optional(),
  branchId: z.number().int().positive().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const publicRegisterSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type PublicRegisterInput = z.infer<typeof publicRegisterSchema>;
