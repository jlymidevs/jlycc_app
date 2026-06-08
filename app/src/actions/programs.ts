// app/src/actions/programs.ts
"use server";

import { db } from "@/lib/db";
import { heartlinkCohort, heartlinkEnrollment, heartlinkSession, heartlinkSessionAttendance } from "@/schema/programs";
import { createCohortSchema, updateCohortSchema, enrollPersonSchema, createHeartlinkSessionSchema } from "@/lib/validations/program";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

export async function createCohort(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    branchId: Number(formData.get("branchId")),
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    sessionCount: formData.get("sessionCount") ? Number(formData.get("sessionCount")) : undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = createCohortSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [c] = await db.insert(heartlinkCohort).values({
    name: parsed.data.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    sessionCount: parsed.data.sessionCount,
    status: parsed.data.status,
  }).returning({ cohortId: heartlinkCohort.cohortId });

  revalidatePath("/programs/heartlink");
  redirect(`/programs/heartlink/${c.cohortId}`);
}

export async function updateCohort(cohortId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    branchId: formData.get("branchId") ? Number(formData.get("branchId")) : undefined,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    sessionCount: formData.get("sessionCount") ? Number(formData.get("sessionCount")) : undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = updateCohortSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.update(heartlinkCohort).set({
    ...parsed.data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).where(eq(heartlinkCohort.cohortId, cohortId as any));

  revalidatePath(`/programs/heartlink/${cohortId}`);
  redirect(`/programs/heartlink/${cohortId}`);
}

export async function enrollPerson(cohortId: number, formData: FormData) {
  const raw = { personId: Number(formData.get("personId")) };
  const parsed = enrollPersonSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db.insert(heartlinkEnrollment).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cohortId: cohortId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: parsed.data.personId as any,
    });
  } catch {
    return { error: "Person already enrolled" };
  }

  revalidatePath(`/programs/heartlink/${cohortId}`);
  redirect(`/programs/heartlink/${cohortId}`);
}

export async function createHeartlinkSession(cohortId: number, formData: FormData) {
  const raw = {
    sessionNumber: Number(formData.get("sessionNumber")),
    topic: (formData.get("topic") as string) || undefined,
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
    durationMinutes: formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : undefined,
    venue: (formData.get("venue") as string) || undefined,
  };
  const parsed = createHeartlinkSessionSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [s] = await db.insert(heartlinkSession).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cohortId: cohortId as any,
    sessionNumber: parsed.data.sessionNumber,
    topic: parsed.data.topic,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    durationMinutes: parsed.data.durationMinutes,
    venue: parsed.data.venue,
  }).returning({ sessionId: heartlinkSession.sessionId });

  revalidatePath(`/programs/heartlink/${cohortId}`);
  redirect(`/programs/heartlink/${cohortId}/sessions/${s.sessionId}/attendance`);
}

export async function markHeartlinkAttendance(sessionId: number, enrollmentId: number, attended: boolean) {
  await db.insert(heartlinkSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrollmentId: enrollmentId as any,
    attended,
  }).onConflictDoUpdate({
    target: [heartlinkSessionAttendance.sessionId, heartlinkSessionAttendance.enrollmentId],
    set: { attended },
  });
  revalidatePath(`/programs/heartlink`);
}

export async function checkInHeartlinkQr(sessionId: number, personId: number) {
  const [sessionRow] = await db
    .select({ cohortId: heartlinkSession.cohortId })
    .from(heartlinkSession)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkSession.sessionId, sessionId as any));
  if (!sessionRow) return { error: "Session not found" };

  const [enrollment] = await db
    .select({ enrollmentId: heartlinkEnrollment.enrollmentId })
    .from(heartlinkEnrollment)
    .where(and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(heartlinkEnrollment.cohortId, sessionRow.cohortId as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(heartlinkEnrollment.personId, personId as any),
    ));
  if (!enrollment) return { error: "Person not enrolled in this cohort" };

  await db.insert(heartlinkSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrollmentId: enrollment.enrollmentId as any,
    attended: true,
    arrivedAt: new Date(),
  }).onConflictDoUpdate({
    target: [heartlinkSessionAttendance.sessionId, heartlinkSessionAttendance.enrollmentId],
    set: { attended: true, arrivedAt: new Date() },
  });

  return { success: true };
}
