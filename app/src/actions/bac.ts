// app/src/actions/bac.ts
"use server";

import { db } from "@/lib/db";
import { bacInitiative, bacSession, bacParticipant, bacSessionAttendance } from "@/schema/missions";
import { createInitiativeSchema, updateInitiativeSchema, addParticipantSchema, createBacSessionSchema } from "@/lib/validations/bac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, isNull } from "drizzle-orm";

export async function createInitiative(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    branchId: Number(formData.get("branchId")),
    targetCommunity: (formData.get("targetCommunity") as string) || undefined,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = createInitiativeSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [init] = await db.insert(bacInitiative).values({
    name: parsed.data.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
    targetCommunity: parsed.data.targetCommunity,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    status: parsed.data.status,
  }).returning({ initiativeId: bacInitiative.initiativeId });

  revalidatePath("/programs/bac");
  redirect(`/programs/bac/${init.initiativeId}`);
}

export async function updateInitiative(initiativeId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    branchId: formData.get("branchId") ? Number(formData.get("branchId")) : undefined,
    targetCommunity: (formData.get("targetCommunity") as string) || undefined,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = updateInitiativeSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.update(bacInitiative).set({
    ...parsed.data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).where(eq(bacInitiative.initiativeId, initiativeId as any));

  revalidatePath(`/programs/bac/${initiativeId}`);
  redirect(`/programs/bac/${initiativeId}`);
}

export async function addParticipant(initiativeId: number, formData: FormData) {
  const raw = {
    personId: Number(formData.get("personId")),
    role: (formData.get("role") as string) || "PARTICIPANT",
  };
  const parsed = addParticipantSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.insert(bacParticipant).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initiativeId: initiativeId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: parsed.data.personId as any,
    role: parsed.data.role,
  });

  revalidatePath(`/programs/bac/${initiativeId}`);
  redirect(`/programs/bac/${initiativeId}`);
}

export async function createBacSession(initiativeId: number, formData: FormData) {
  const raw = {
    sessionNumber: Number(formData.get("sessionNumber")),
    topic: (formData.get("topic") as string) || undefined,
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
    durationMinutes: formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : undefined,
    venue: (formData.get("venue") as string) || undefined,
  };
  const parsed = createBacSessionSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [s] = await db.insert(bacSession).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initiativeId: initiativeId as any,
    sessionNumber: parsed.data.sessionNumber,
    topic: parsed.data.topic,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    durationMinutes: parsed.data.durationMinutes,
    venue: parsed.data.venue,
  }).returning({ sessionId: bacSession.sessionId });

  revalidatePath(`/programs/bac/${initiativeId}`);
  redirect(`/programs/bac/${initiativeId}/sessions/${s.sessionId}/attendance`);
}

export async function markBacAttendance(sessionId: number, personId: number, attended: boolean) {
  await db.insert(bacSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    attended,
  }).onConflictDoUpdate({
    target: [bacSessionAttendance.sessionId, bacSessionAttendance.personId],
    set: { attended },
  });
  revalidatePath(`/programs/bac`);
}

export async function checkInBacQr(initiativeId: number, sessionId: number, personId: number) {
  const [existing] = await db
    .select({ participantId: bacParticipant.participantId })
    .from(bacParticipant)
    .where(and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(bacParticipant.initiativeId, initiativeId as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(bacParticipant.personId, personId as any),
      isNull(bacParticipant.leftAt),
    ));

  const attendedAs = existing ? "ENROLLED" : "WALK_IN";
  if (!existing) {
    await db.insert(bacParticipant).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initiativeId: initiativeId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: personId as any,
      role: "PARTICIPANT",
    });
  }

  await db.insert(bacSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    attended: true,
    attendedAs,
  }).onConflictDoUpdate({
    target: [bacSessionAttendance.sessionId, bacSessionAttendance.personId],
    set: { attended: true, attendedAs },
  });

  return { success: true };
}
