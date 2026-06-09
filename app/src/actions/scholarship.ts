// app/src/actions/scholarship.ts
"use server";

import { db } from "@/lib/db";
import { scholarProgram, scholarshipAward } from "@/schema/missions";
import {
  createScholarProgramSchema,
  updateScholarProgramSchema,
  createAwardSchema,
} from "@/lib/validations/scholarship";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createScholarProgram(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = createScholarProgramSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [p] = await db.insert(scholarProgram).values({
    name: parsed.data.name,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    description: parsed.data.description,
    status: parsed.data.status ?? "PLANNING",
  }).returning({ programId: scholarProgram.programId });

  revalidatePath("/missions/scholarships");
  redirect(`/missions/scholarships/${p.programId}`);
}

export async function updateScholarProgram(programId: number, formData: FormData) {
  const raw = {
    name: (formData.get("name") as string) || undefined,
    startsOn: (formData.get("startsOn") as string) || undefined,
    endsOn: (formData.get("endsOn") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
  };
  const parsed = updateScholarProgramSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.update(scholarProgram)
    .set({
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.startsOn !== undefined && { startsOn: parsed.data.startsOn }),
      ...(parsed.data.endsOn !== undefined && { endsOn: parsed.data.endsOn }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.status && { status: parsed.data.status }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  revalidatePath(`/missions/scholarships/${programId}`);
  redirect(`/missions/scholarships/${programId}`);
}

export async function createAward(programId: number, formData: FormData) {
  const raw = {
    memberId: Number(formData.get("memberId")),
    term: (formData.get("term") as string) || undefined,
    amount: (formData.get("amount") as string) || undefined,
    schoolName: (formData.get("schoolName") as string) || undefined,
    sponsorMemberId: formData.get("sponsorMemberId")
      ? Number(formData.get("sponsorMemberId"))
      : undefined,
    status: (formData.get("status") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = createAwardSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.insert(scholarshipAward).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    programId: programId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memberId: parsed.data.memberId as any,
    term: parsed.data.term,
    amount: parsed.data.amount,
    schoolName: parsed.data.schoolName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sponsorMemberId: parsed.data.sponsorMemberId as any,
    status: parsed.data.status ?? "AWARDED",
    notes: parsed.data.notes,
  });

  revalidatePath(`/missions/scholarships/${programId}`);
  redirect(`/missions/scholarships/${programId}`);
}
