// app/src/actions/members.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { member } from "@/schema/membership";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/member";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createMember(formData: FormData) {
  const raw = {
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    gender: formData.get("gender") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    email: formData.get("email") || undefined,
    mobile: formData.get("mobile") || undefined,
    branchId: Number(formData.get("branchId")),
    currentStage: formData.get("currentStage"),
    joinedAt: formData.get("joinedAt"),
  };

  const parsed = createMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Insert person
  const [newPerson] = await db
    .insert(person)
    .values({
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      suffix: data.suffix,
      preferredName: data.preferredName,
      dateOfBirth: data.dateOfBirth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gender: data.gender as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      maritalStatus: data.maritalStatus as any,
    })
    .returning({ personId: person.personId });

  // Insert contact info if provided
  if (data.email) {
    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "EMAIL",
      value: data.email,
      isPrimary: true,
    });
  }
  if (data.mobile) {
    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "MOBILE",
      value: data.mobile,
      isPrimary: true,
    });
  }

  // Insert member record
  const [newMember] = await db
    .insert(member)
    .values({
      personId: newPerson.personId,
      branchId: data.branchId,
      memberCode: `M-${newPerson.personId}`,
      currentStage: data.currentStage,
      joinedAt: new Date(data.joinedAt),
    })
    .returning({ memberId: member.memberId });

  revalidatePath("/members");
  redirect(`/members/${newMember.memberId}`);
}

export async function updateMember(memberId: number, formData: FormData) {
  const raw = {
    firstName: formData.get("firstName") || undefined,
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName") || undefined,
    gender: formData.get("gender") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    currentStage: formData.get("currentStage") || undefined,
  };

  const parsed = updateMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Get person_id for this member
  const [existing] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);

  if (!existing) return { errors: { _: ["Member not found"] } };

  // Update person fields
  if (data.firstName || data.lastName || data.gender || data.maritalStatus) {
    await db
      .update(person)
      .set({
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.middleName !== undefined && { middleName: data.middleName }),
        ...(data.lastName && { lastName: data.lastName }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.gender && { gender: data.gender as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.maritalStatus && { maritalStatus: data.maritalStatus as any }),
      })
      .where(eq(person.personId, existing.personId));
  }

  // Update member stage (DB trigger writes lifecycle_stage_history automatically)
  if (data.currentStage) {
    await db
      .update(member)
      .set({ currentStage: data.currentStage })
      .where(eq(member.memberId, memberId));
  }

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  redirect(`/members/${memberId}`);
}
