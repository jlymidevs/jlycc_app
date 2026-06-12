"use server";

import { db } from "@/lib/db";
import { member, lifecycleStageHistory } from "@/schema/membership";
import { ministryMembership } from "@/schema/ministries";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { headChapterIds } from "@/actions/join-requests";
import { nextPromotionStage } from "@/lib/stage-promotion";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Ministry head promotes a chapter member one lifecycle step (max INNER_CORE). */
export async function promoteMember(formData: FormData) {
  const session = await requireRole("MINISTRY_HEAD");
  const membershipId = Number(formData.get("membershipId"));
  if (!membershipId) return { error: "Membership required" };

  const chapters = await headChapterIds();
  const [target] = await db
    .select({
      memberId: ministryMembership.memberId,
      chapterId: ministryMembership.chapterId,
      currentStage: member.currentStage,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .where(
      and(eq(ministryMembership.membershipId, membershipId), isNull(ministryMembership.endedAt))
    )
    .limit(1);
  if (!target || !chapters.includes(target.chapterId)) {
    return { error: "Member is not in a chapter you lead" };
  }

  const next = nextPromotionStage(target.currentStage);
  if (!next) return { error: "Member is already at the top of the promotion ladder" };

  // If there's a DB trigger on member.current_stage that fires on update, it writes history.
  // We then stamp actor + reason on the newest history row.
  await db.update(member).set({ currentStage: next }).where(eq(member.memberId, target.memberId));

  const [actor] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.email, session.user!.email!))
    .limit(1);
  if (actor?.personId) {
    try {
      const [latest] = await db
        .select({ historyId: lifecycleStageHistory.historyId })
        .from(lifecycleStageHistory)
        .where(eq(lifecycleStageHistory.memberId, target.memberId))
        .orderBy(desc(lifecycleStageHistory.changedAt))
        .limit(1);
      if (latest) {
        await db
          .update(lifecycleStageHistory)
          .set({ changedByPersonId: actor.personId, reason: "Promoted by ministry head" })
          .where(eq(lifecycleStageHistory.historyId, latest.historyId));
      }
    } catch (err) {
      console.error("Failed to stamp promotion history row:", err);
    }
  }

  revalidatePath("/ministry");
  return { success: true };
}
