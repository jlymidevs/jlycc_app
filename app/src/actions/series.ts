// app/src/actions/series.ts
"use server";

import { db } from "@/lib/db";
import { event, eventSeries } from "@/schema/events";
import { createSeriesSchema } from "@/lib/validations/series";
import { generateOccurrences } from "@/lib/series-generator";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";

export async function createSeries(formData: FormData) {
  const dayOfWeekRaw = formData.get("dayOfWeek");
  const dayOfMonthRaw = formData.get("dayOfMonth");

  const raw = {
    name: formData.get("name"),
    eventTypeId: Number(formData.get("eventTypeId")),
    branchId: formData.get("branchId")
      ? Number(formData.get("branchId"))
      : undefined,
    recurrencePattern: formData.get("recurrencePattern"),
    startsOn: formData.get("startsOn"),
    endsOn: (formData.get("endsOn") as string) || undefined,
    config: {
      dayOfWeek:
        dayOfWeekRaw !== null && dayOfWeekRaw !== ""
          ? Number(dayOfWeekRaw)
          : undefined,
      dayOfMonth:
        dayOfMonthRaw !== null && dayOfMonthRaw !== ""
          ? Number(dayOfMonthRaw)
          : undefined,
      time: formData.get("time"),
      durationMinutes: Number(formData.get("durationMinutes")),
      venue: (formData.get("venue") as string) || undefined,
    },
  };

  const parsed = createSeriesSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const [row] = await db
    .insert(eventSeries)
    .values({
      name: d.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: d.eventTypeId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: d.branchId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recurrencePattern: d.recurrencePattern as any,
      recurrenceConfig: d.config,
      startsOn: d.startsOn,
      endsOn: d.endsOn,
    })
    .returning({ seriesId: eventSeries.seriesId });

  await generateOccurrences(row.seriesId);

  revalidatePath("/events/series");
  revalidatePath("/events");
  revalidatePath("/church/calendar");
  redirect("/events/series");
}

export async function cancelSeries(seriesId: number) {
  await db
    .update(eventSeries)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "ENDED" as any })
    .where(eq(eventSeries.seriesId, seriesId));

  await db
    .update(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "CANCELLED" as any })
    .where(
      and(
        eq(event.seriesId, seriesId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(event.status, "SCHEDULED" as any),
        gt(event.startsAt, new Date())
      )
    );

  revalidatePath("/events/series");
  revalidatePath("/events");
  revalidatePath("/church/calendar");
  redirect("/events/series");
}
