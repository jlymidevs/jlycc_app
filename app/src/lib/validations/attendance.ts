import { z } from "zod";

export const checkInSchema = z.object({
  eventId: z.number().int().positive(),
  personId: z.number().int().positive(),
});

export const captureVisitorSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  birthday: z.string().min(1, "Birthday required"),
  email: z.string().email("Valid email required"),
  consentToContact: z.boolean().default(false),
  invitedByPersonId: z.number().int().positive().optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CaptureVisitorInput = z.infer<typeof captureVisitorSchema>;
