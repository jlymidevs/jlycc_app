// app/src/lib/validations/account.ts
import { z } from "zod";

export const signupSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Optional: when no active ministry heads exist the picker is hidden.
  chapterId: z.number().int().positive().optional(),
});

export const joinRequestSchema = z.object({
  chapterId: z.number().int().positive("Ministry required"),
  priority: z.number().int().min(1, "Priority must be 1 or higher"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
