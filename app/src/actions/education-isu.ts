// app/src/actions/education-isu.ts
"use server";

import { db } from "@/lib/db";
import {
  isuStudent, isuTrackProgression, isuSession, isuSessionAttendance,
} from "@/schema/education";
import {
  registerIsuStudentSchema, progressTrackSchema, createIsuSessionSchema,
} from "@/lib/validations/education-isu";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function registerIsuStudent(formData: FormData) {
  const raw = {
    personId: Number(formData.get("personId")),
    currentTrackId: formData.get("currentTrackId") ? Number(formData.get("currentTrackId")) : undefined,
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = registerIsuStudentSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    const [s] = await db.insert(isuStudent).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: parsed.data.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentTrackId: parsed.data.currentTrackId as any,
      enrolledOn: parsed.data.enrolledOn,
    }).returning({ studentId: isuStudent.studentId });

    // Record initial track progression if track given
    if (parsed.data.currentTrackId) {
      await db.insert(isuTrackProgression).values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        studentId: s.studentId as any,
        fromTrackId: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toTrackId: parsed.data.currentTrackId as any,
      });
    }

    revalidatePath("/education/isu/students");
    redirect(`/education/isu/students/${s.studentId}`);
  } catch {
    return { error: "Student already registered for this person" };
  }
}

export async function progressTrack(studentId: number, formData: FormData) {
  const raw = {
    toTrackId: Number(formData.get("toTrackId")),
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = progressTrackSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // get current track for from_track_id
  const [student] = await db
    .select({ currentTrackId: isuStudent.currentTrackId })
    .from(isuStudent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));
  if (!student) return { error: "Student not found" };

  await db.insert(isuTrackProgression).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studentId: studentId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fromTrackId: student.currentTrackId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toTrackId: parsed.data.toTrackId as any,
    notes: parsed.data.notes,
  });

  await db.update(isuStudent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ currentTrackId: parsed.data.toTrackId as any })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));

  revalidatePath(`/education/isu/students/${studentId}`);
  redirect(`/education/isu/students/${studentId}`);
}

export async function createIsuSession(formData: FormData) {
  const raw = {
    branchId: Number(formData.get("branchId")),
    trackId: Number(formData.get("trackId")),
    topic: (formData.get("topic") as string) || undefined,
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
  };
  const parsed = createIsuSessionSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [s] = await db.insert(isuSession).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackId: parsed.data.trackId as any,
    topic: parsed.data.topic,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
  }).returning({ sessionId: isuSession.sessionId });

  revalidatePath("/education/isu/sessions");
  redirect(`/education/isu/sessions/${s.sessionId}/attendance`);
}

export async function markIsuAttendance(sessionId: number, personId: number, attended: boolean) {
  await db.insert(isuSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    attended,
  }).onConflictDoUpdate({
    target: [isuSessionAttendance.sessionId, isuSessionAttendance.personId],
    set: { attended },
  });
  revalidatePath(`/education/isu/sessions/${sessionId}/attendance`);
}
