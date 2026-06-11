// app/src/actions/education-bc.ts
"use server";

import { db } from "@/lib/db";
import {
  bcStudent, bcEnrollment, bcClassAttendance,
} from "@/schema/education";
import {
  registerBcStudentSchema, enrollInOfferingSchema, recordClassAttendanceSchema,
} from "@/lib/validations/education-bc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function registerBcStudent(formData: FormData) {
  const raw = {
    personId: Number(formData.get("personId")),
    cohortId: Number(formData.get("cohortId")),
    studentNumber: formData.get("studentNumber") as string,
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = registerBcStudentSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // redirect() throws NEXT_REDIRECT, so it must stay outside the try/catch
  // or the catch swallows the navigation and reports a false error.
  let studentId: number;
  try {
    const [s] = await db.insert(bcStudent).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: parsed.data.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cohortId: parsed.data.cohortId as any,
      studentNumber: parsed.data.studentNumber,
      enrolledOn: parsed.data.enrolledOn,
    }).returning({ studentId: bcStudent.studentId });
    studentId = s.studentId;
  } catch {
    return { error: "Student already registered for this person" };
  }

  revalidatePath("/education/bc/students");
  redirect(`/education/bc/students/${studentId}`);
}

export async function enrollInOffering(offeringId: number, formData: FormData) {
  const raw = {
    studentId: Number(formData.get("studentId")),
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = enrollInOfferingSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db.insert(bcEnrollment).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentId: parsed.data.studentId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      offeringId: offeringId as any,
      enrolledOn: parsed.data.enrolledOn,
    });
  } catch {
    return { error: "Student already enrolled in this offering" };
  }

  revalidatePath(`/education/bc/offerings/${offeringId}`);
  redirect(`/education/bc/offerings/${offeringId}`);
}

export async function recordClassAttendance(offeringId: number, formData: FormData) {
  const raw = {
    studentId: Number(formData.get("studentId")),
    classDate: formData.get("classDate") as string,
    attended: formData.get("attended") === "true",
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = recordClassAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.insert(bcClassAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offeringId: offeringId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studentId: parsed.data.studentId as any,
    classDate: parsed.data.classDate,
    attended: parsed.data.attended,
    notes: parsed.data.notes,
  }).onConflictDoUpdate({
    target: [bcClassAttendance.offeringId, bcClassAttendance.studentId, bcClassAttendance.classDate],
    set: { attended: parsed.data.attended, notes: parsed.data.notes },
  });

  revalidatePath(`/education/bc/offerings/${offeringId}/attendance`);
}
