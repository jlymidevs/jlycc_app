// app/src/actions/registrations.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { event, eventRegistration } from "@/schema/events";
import { publicRegisterSchema } from "@/lib/validations/event";
import { revalidatePath } from "next/cache";
import { and, eq, ne, inArray, count } from "drizzle-orm";

export async function registerForEvent(
  eventId: number,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
  };

  const parsed = publicRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: firstError };
  }

  const { name, email } = parsed.data;

  // Find existing person by email
  const existingContact = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .where(and(eq(contactInfo.type, "EMAIL"), eq(contactInfo.value, email)))
    .limit(1);

  let personId: number;

  if (existingContact.length > 0) {
    personId = existingContact[0].personId;
  } else {
    // Split name into first/last (last word = last name, rest = first name)
    const nameParts = name.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts.pop()! : "";
    const firstName = nameParts.join(" ") || name.trim();

    const [newPerson] = await db
      .insert(person)
      .values({ firstName, lastName: lastName || firstName })
      .returning({ personId: person.personId });

    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });

    personId = newPerson.personId;
  }

  // Check for duplicate registration (non-cancelled)
  const duplicate = await db
    .select({ registrationId: eventRegistration.registrationId })
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.personId, personId),
        ne(eventRegistration.status, "CANCELLED")
      )
    )
    .limit(1);

  if (duplicate.length > 0) {
    return { error: "already_registered" };
  }

  // Check capacity
  const [eventRow] = await db
    .select({ expectedAttendance: event.expectedAttendance })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  let registrationStatus: "REGISTERED" | "WAITLISTED" = "REGISTERED";

  if (eventRow?.expectedAttendance) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(eventRegistration)
      .where(
        and(
          eq(eventRegistration.eventId, eventId),
          inArray(eventRegistration.status, ["REGISTERED", "CONFIRMED"])
        )
      );

    if (total >= eventRow.expectedAttendance) {
      registrationStatus = "WAITLISTED";
    }
  }

  await db.insert(eventRegistration).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventId: eventId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: registrationStatus as any,
  });

  return { success: true };
}

export async function updateRegistrationStatus(
  registrationId: number,
  newStatus: "CONFIRMED" | "CANCELLED"
) {
  const [reg] = await db
    .select({ eventId: eventRegistration.eventId })
    .from(eventRegistration)
    .where(eq(eventRegistration.registrationId, registrationId))
    .limit(1);

  await db
    .update(eventRegistration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status: newStatus as any })
    .where(eq(eventRegistration.registrationId, registrationId));

  if (reg) revalidatePath(`/events/${reg.eventId}`);
}
