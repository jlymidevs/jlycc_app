// app/src/lib/validations/series.ts
import { z } from "zod";

export const recurrenceConfigSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  durationMinutes: z.number().int().positive("Duration required"),
  venue: z.string().optional(),
});

export const createSeriesSchema = z
  .object({
    name: z.string().min(1, "Series name required"),
    eventTypeId: z.number().int().positive("Event type required"),
    branchId: z.number().int().positive().optional(),
    recurrencePattern: z.enum(["WEEKLY", "MONTHLY"]),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date required"),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date")
      .optional(),
    config: recurrenceConfigSchema,
  })
  .superRefine((val, ctx) => {
    if (val.recurrencePattern === "WEEKLY" && val.config.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "dayOfWeek"],
        message: "Day of week required for weekly series",
      });
    }
    if (val.recurrencePattern === "MONTHLY" && val.config.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", "dayOfMonth"],
        message: "Day of month required for monthly series",
      });
    }
    if (val.endsOn && val.endsOn < val.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "End date must be on or after start date",
      });
    }
  });

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type RecurrenceConfig = z.infer<typeof recurrenceConfigSchema>;
