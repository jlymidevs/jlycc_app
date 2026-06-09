import { z } from "zod";

export const createChapterSchema = z.object({
  ministryId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  launchedOn: z.string().date().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]).default("ACTIVE"),
});

export const addMemberSchema = z
  .object({
    chapterId: z.number().int().positive(),
    memberId: z.number().int().positive(),
    joinedAt: z.string().date("Join date required"),
    isLeader: z.boolean().default(false),
    leaderRole: z
      .enum(["HEAD", "ASSISTANT_HEAD", "COORDINATOR"])
      .optional(),
  })
  .refine((d) => !d.isLeader || d.leaderRole != null, {
    message: "Leader role required when isLeader is true",
    path: ["leaderRole"],
  });

export const endMemberSchema = z.object({
  membershipId: z.number().int().positive(),
  endedAt: z.string().date("End date required"),
  endedReason: z.string().optional(),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type EndMemberInput = z.infer<typeof endMemberSchema>;
