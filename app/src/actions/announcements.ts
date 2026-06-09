"use server";

import { db } from "@/lib/db";
import { announcement, announcementRecipient } from "@/schema/communications";
import { member } from "@/schema/membership";
import { contactInfo, person } from "@/schema/core";
import { createAnnouncementSchema, CreateAnnouncementInput } from "@/lib/validations/announcements";
import { eq, and, isNull, desc, count, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendAnnouncementEmail } from "@/lib/email";
import { ghlSendSMS } from "@/lib/ghl";

// Create a draft announcement
export async function createAnnouncement(
  data: CreateAnnouncementInput
): Promise<{ announcementId: number } | { error: string }> {
  const parsed = createAnnouncementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [row] = await db
    .insert(announcement)
    .values({
      title: parsed.data.title,
      body: parsed.data.body,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetType: parsed.data.targetType as any,
      targetId: parsed.data.targetId ?? null,
      status: "DRAFT",
    })
    .returning({ announcementId: announcement.announcementId });

  revalidatePath("/announcements");
  return { announcementId: row.announcementId };
}

// Publish a draft announcement — fans out recipients and sends emails
export async function publishAnnouncement(
  id: number
): Promise<{ success: true; recipientCount: number; deliveredCount: number } | { error: string }> {
  const [row] = await db
    .select()
    .from(announcement)
    .where(eq(announcement.announcementId, id))
    .limit(1);

  if (!row) return { error: "Announcement not found" };
  if (row.status !== "DRAFT") return { error: "Only DRAFT announcements can be published" };

  // Fan out recipients
  let targetMembers: { personId: number }[] = [];

  if (row.targetType === "ALL_MEMBERS") {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(isNull(member.deletedAt));
  } else if (row.targetType === "BRANCH" && row.targetId) {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(and(
        eq(member.branchId, Number(row.targetId)),
        isNull(member.deletedAt)
      ));
  } else if (row.targetType === "LIFECYCLE_STAGE" && row.targetId) {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(and(
        eq(member.currentStage, row.targetId),
        isNull(member.deletedAt)
      ));
  }
  // MANUAL: no auto fan-out in this plan

  if (targetMembers.length > 0) {
    await db
      .insert(announcementRecipient)
      .values(
        targetMembers.map((m) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          announcementId: id as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personId: m.personId as any,
        }))
      )
      .onConflictDoNothing();
  }

  await db
    .update(announcement)
    .set({ status: "PUBLISHED", publishedAt: new Date() })
    .where(eq(announcement.announcementId, id));

  // Fetch recipients with primary email and name
  const recipientsWithEmail = await db
    .select({
      recipientId: announcementRecipient.recipientId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(announcementRecipient)
    .innerJoin(person, eq(announcementRecipient.personId, person.personId))
    .innerJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, announcementRecipient.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(eq(announcementRecipient.announcementId, id));

  // Fetch recipients with GHL contact ID for SMS
  const recipientsWithGHL = await db
    .select({
      personId: announcementRecipient.personId,
      ghlContactId: person.ghlContactId,
    })
    .from(announcementRecipient)
    .innerJoin(person, eq(announcementRecipient.personId, person.personId))
    .where(eq(announcementRecipient.announcementId, id));

  // Send in batches of 50
  let deliveredCount = 0;
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipientsWithEmail.length; i += BATCH_SIZE) {
    const batch = recipientsWithEmail.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (r) => {
        const result = await sendAnnouncementEmail({
          to: r.email,
          recipientName: `${r.firstName} ${r.lastName}`.trim(),
          title: row.title,
          body: row.body,
        });
        if (result.success) {
          await db
            .update(announcementRecipient)
            .set({ deliveredAt: new Date() })
            .where(eq(announcementRecipient.recipientId, r.recipientId));
          deliveredCount++;
        }
      })
    );
  }

  // Fire GHL SMS (non-blocking, best-effort)
  const smsMessage = `${row.title}\n\n${row.body}`;
  await Promise.allSettled(
    recipientsWithGHL
      .filter((r) => r.ghlContactId)
      .map((r) => ghlSendSMS(r.ghlContactId!, smsMessage))
  );

  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { success: true, recipientCount: targetMembers.length, deliveredCount };
}

// Archive an announcement
export async function archiveAnnouncement(
  id: number
): Promise<{ success: true } | { error: string }> {
  const [row] = await db
    .select({ status: announcement.status })
    .from(announcement)
    .where(eq(announcement.announcementId, id))
    .limit(1);

  if (!row) return { error: "Announcement not found" };
  if (row.status === "ARCHIVED") return { error: "Already archived" };

  await db
    .update(announcement)
    .set({ status: "ARCHIVED" })
    .where(eq(announcement.announcementId, id));

  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { success: true };
}

// List non-archived announcements with recipient count
export async function listAnnouncements() {
  const rows = await db
    .select({
      announcementId: announcement.announcementId,
      title: announcement.title,
      targetType: announcement.targetType,
      status: announcement.status,
      publishedAt: announcement.publishedAt,
      createdAt: announcement.createdAt,
      recipientCount: count(announcementRecipient.recipientId),
    })
    .from(announcement)
    .leftJoin(
      announcementRecipient,
      eq(announcementRecipient.announcementId, announcement.announcementId)
    )
    .where(ne(announcement.status, "ARCHIVED"))
    .groupBy(
      announcement.announcementId,
      announcement.title,
      announcement.targetType,
      announcement.status,
      announcement.publishedAt,
      announcement.createdAt
    )
    .orderBy(desc(announcement.createdAt));

  return rows;
}

// Get single announcement with recipient count
export async function getAnnouncement(id: number) {
  const [row] = await db
    .select({
      announcementId: announcement.announcementId,
      title: announcement.title,
      body: announcement.body,
      targetType: announcement.targetType,
      targetId: announcement.targetId,
      status: announcement.status,
      publishedAt: announcement.publishedAt,
      createdAt: announcement.createdAt,
    })
    .from(announcement)
    .where(eq(announcement.announcementId, id))
    .limit(1);

  if (!row) return null;

  const [{ total }] = await db
    .select({ total: count() })
    .from(announcementRecipient)
    .where(eq(announcementRecipient.announcementId, id));

  return { ...row, recipientCount: total };
}
