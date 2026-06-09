"use server";

import { db } from "@/lib/db";
import { announcement, announcementRecipient } from "@/schema/communications";
import { member } from "@/schema/membership";
import { createAnnouncementSchema, CreateAnnouncementInput } from "@/lib/validations/announcements";
import { eq, and, isNull, desc, count, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

// Publish a draft announcement — fans out recipients
export async function publishAnnouncement(
  id: number
): Promise<{ success: true; recipientCount: number } | { error: string }> {
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

  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { success: true, recipientCount: targetMembers.length };
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
