// app/src/actions/attendance.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { event } from "@/schema/events";
import { checkIn as checkInTable, visitorCapture } from "@/schema/attendance";
import { checkInSchema, captureVisitorSchema, CaptureVisitorInput } from "@/lib/validations/attendance";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, or, isNull } from "drizzle-orm";

export type PersonSearchResult = {
  personId: number;
  firstName: string;
  lastName: string;
  email: string | null;
};

export async function searchPersons(
  query: string
): Promise<PersonSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = `%${query.trim()}%`;

  const rows = await db
    .select({
      personId: person.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(person)
    .leftJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, person.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(
      and(
        isNull(person.deletedAt),
        or(
          ilike(person.firstName, q),
          ilike(person.lastName, q),
          ilike(contactInfo.value, q)
        )
      )
    )
    .limit(10);

  return rows.map((r) => ({
    personId: r.personId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
  }));
}

export async function checkInPerson(
  eventId: number,
  personId: number
): Promise<{ success: true; name: string } | { error: string }> {
  const parsed = checkInSchema.safeParse({ eventId, personId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Duplicate guard
  const existing = await db
    .select({ checkInId: checkInTable.checkInId })
    .from(checkInTable)
    .where(
      and(
        eq(checkInTable.eventId, eventId),
        eq(checkInTable.personId, personId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "already_checked_in" };
  }

  // Get branchId from event
  const [eventRow] = await db
    .select({
      branchId: event.branchId,
      hostBranchId: event.hostBranchId,
    })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  const branchId = eventRow?.hostBranchId ?? eventRow?.branchId;
  if (!branchId) {
    return { error: "Event has no branch assigned" };
  }

  const [personRow] = await db
    .select({ firstName: person.firstName, lastName: person.lastName })
    .from(person)
    .where(eq(person.personId, personId))
    .limit(1);

  const now = new Date();

  try {
    await db.insert(checkInTable).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventId: eventId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: branchId as any,
      checkedInAt: now,
      checkInMethod: "USHER",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Check-in failed" };
  }

  revalidatePath(`/events/${eventId}/attendance`);
  const name = personRow
    ? `${personRow.firstName} ${personRow.lastName}`
    : "Unknown";
  return { success: true, name };
}

export async function captureVisitor(
  eventId: number,
  data: CaptureVisitorInput
): Promise<{ success: true } | { error: string }> {
  const parsed = captureVisitorSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { firstName, lastName, birthday, email, consentToContact, invitedByPersonId } =
    parsed.data;

  // Check email not already in system
  const existing = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .where(and(eq(contactInfo.type, "EMAIL"), eq(contactInfo.value, email)))
    .limit(1);

  if (existing.length > 0) {
    return { error: "person_already_exists" };
  }

  // Get branchId from event
  const [eventRow] = await db
    .select({ branchId: event.branchId, hostBranchId: event.hostBranchId })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  const branchId = eventRow?.hostBranchId ?? eventRow?.branchId;
  if (!branchId) {
    return { error: "Event has no branch assigned" };
  }

  try {
  await db.transaction(async (tx) => {
    const [newPerson] = await tx
      .insert(person)
      .values({ firstName, lastName, dateOfBirth: birthday })
      .returning({ personId: person.personId });

    await tx.insert(contactInfo).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: newPerson.personId as any,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });

    const [capture] = await tx
      .insert(visitorCapture)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personId: newPerson.personId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventId: eventId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchId: branchId as any,
        consentToContact,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(invitedByPersonId && { invitedByPersonId: invitedByPersonId as any }),
      })
      .returning({ ftvCaptureId: visitorCapture.ftvCaptureId });

    const now = new Date();
    await tx.insert(checkInTable).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventId: eventId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: newPerson.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: branchId as any,
      checkedInAt: now,
      checkInMethod: "USHER",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ftvCaptureId: capture.ftvCaptureId as any,
    });
  });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Visitor capture failed" };
  }

  revalidatePath(`/events/${eventId}/attendance`);
  return { success: true };
}
