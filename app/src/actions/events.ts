// app/src/actions/events.ts
"use server";

import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { createEventSchema, updateEventSchema } from "@/lib/validations/event";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createEvent(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    eventTypeId: Number(formData.get("eventTypeId")),
    startsAt: formData.get("startsAt") as string,
    endsAt: (formData.get("endsAt") as string) || undefined,
    venue: (formData.get("venue") as string) || undefined,
    expectedAttendance: formData.get("expectedAttendance")
      ? Number(formData.get("expectedAttendance"))
      : undefined,
    seriesId: formData.get("seriesId")
      ? Number(formData.get("seriesId"))
      : undefined,
    branchId: formData.get("branchId")
      ? Number(formData.get("branchId"))
      : undefined,
  };

  const parsed = createEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [newEvent] = await db
    .insert(event)
    .values({
      name: data.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: data.eventTypeId as any,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      venue: data.venue,
      expectedAttendance: data.expectedAttendance,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesId: data.seriesId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: data.branchId as any,
    })
    .returning({ eventId: event.eventId });

  revalidatePath("/events");
  redirect(`/events/${newEvent.eventId}`);
}

export async function updateEvent(eventId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    eventTypeId: formData.get("eventTypeId")
      ? Number(formData.get("eventTypeId"))
      : undefined,
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
    venue: (formData.get("venue") as string) || undefined,
    expectedAttendance: formData.get("expectedAttendance")
      ? Number(formData.get("expectedAttendance"))
      : undefined,
    seriesId: formData.get("seriesId")
      ? Number(formData.get("seriesId"))
      : undefined,
    branchId: formData.get("branchId")
      ? Number(formData.get("branchId"))
      : undefined,
  };

  const parsed = updateEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(event)
    .set({
      ...(data.name && { name: data.name }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(data.eventTypeId && { eventTypeId: data.eventTypeId as any }),
      ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && {
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      }),
      ...(data.venue !== undefined && { venue: data.venue || null }),
      ...(data.expectedAttendance !== undefined && {
        expectedAttendance: data.expectedAttendance,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(data.seriesId !== undefined && { seriesId: data.seriesId as any }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(data.branchId !== undefined && { branchId: data.branchId as any }),
    })
    .where(eq(event.eventId, eventId));

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function cancelEvent(eventId: number) {
  await db
    .update(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: "CANCELLED" as any })
    .where(eq(event.eventId, eventId));

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}
