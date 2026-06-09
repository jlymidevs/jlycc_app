import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  body: z.string().min(1, "Body is required").max(5000, "Body must be 5000 characters or less"),
  targetType: z.enum(["ALL_MEMBERS", "BRANCH", "LIFECYCLE_STAGE", "MANUAL"]),
  targetId: z.string().optional(),
});

export const publishAnnouncementSchema = z.object({
  id: z.number().int().positive(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
