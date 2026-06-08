// app/src/lib/validations/member.ts
import { z } from "zod";

export const createMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  suffix: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNDISCLOSED"]).optional(),
  maritalStatus: z
    .enum(["SINGLE", "MARRIED", "WIDOWED", "SEPARATED", "DIVORCED"])
    .optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobile: z.string().optional(),
  branchId: z.number().int().positive("Branch is required"),
  currentStage: z.string().min(1, "Lifecycle stage is required"),
  joinedAt: z.string().date("Invalid date"),
});

export const updateMemberSchema = createMemberSchema.partial();

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
