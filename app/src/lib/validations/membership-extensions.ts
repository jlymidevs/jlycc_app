// app/src/lib/validations/membership-extensions.ts
import { z } from "zod";

const applicationStatusEnum = z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]);

export const submitApplicationSchema = z.object({
  memberId: z.number().int().positive("Member ID is required"),
});

export const reviewApplicationSchema = z.object({
  applicationId: z.number().int().positive("Application ID is required"),
  status: applicationStatusEnum,
  decisionNotes: z.string().optional(),
});

export const assignRoleSchema = z.object({
  memberId: z.number().int().positive("Member ID is required"),
  roleId: z.number().int().positive("Role ID is required"),
  assignedAt: z.string().date("Invalid date"),
  notes: z.string().optional(),
});

export const endRoleSchema = z.object({
  memberRoleId: z.number().int().positive("Member role ID is required"),
  endedAt: z.string().date("Invalid date"),
});

export const assignPcmSchema = z.object({
  carerMemberId: z.number().int().positive("Carer member ID is required"),
  assignedMemberId: z.number().int().positive("Assigned member ID is required"),
  assignedAt: z.string().date("Invalid date"),
  notes: z.string().optional(),
});

export const endPcmSchema = z.object({
  assignmentId: z.number().int().positive("Assignment ID is required"),
  endedAt: z.string().date("Invalid date"),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type EndRoleInput = z.infer<typeof endRoleSchema>;
export type AssignPcmInput = z.infer<typeof assignPcmSchema>;
export type EndPcmInput = z.infer<typeof endPcmSchema>;
