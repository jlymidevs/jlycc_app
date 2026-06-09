// app/src/lib/validations/scholarship.ts
import { z } from "zod";

const programStatusEnum = z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]);
const awardStatusEnum = z.enum(["AWARDED", "ACTIVE", "COMPLETED", "REVOKED"]);

export const createScholarProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startsOn: z.string().date("Invalid date").optional(),
  endsOn: z.string().date("Invalid date").optional(),
  description: z.string().optional(),
  status: programStatusEnum.optional(),
});

export const updateScholarProgramSchema = createScholarProgramSchema.partial();

export const createAwardSchema = z.object({
  memberId: z.number().int().positive("Member is required"),
  term: z.string().optional(),
  amount: z.string().optional(),
  schoolName: z.string().optional(),
  sponsorMemberId: z.number().int().positive().optional(),
  status: awardStatusEnum.optional(),
  notes: z.string().optional(),
});

export type CreateScholarProgramInput = z.infer<typeof createScholarProgramSchema>;
export type UpdateScholarProgramInput = z.infer<typeof updateScholarProgramSchema>;
export type CreateAwardInput = z.infer<typeof createAwardSchema>;
