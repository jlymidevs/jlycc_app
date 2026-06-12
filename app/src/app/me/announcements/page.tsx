// app/src/app/me/announcements/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { announcement, announcementRecipient } from "@/schema/communications";
import { requireRole } from "@/lib/authz-server";
import { formatAnnouncementDate } from "@/lib/member-announcements";
import { and, desc, eq } from "drizzle-orm";
import MotionCard from "@/components/motion-card";

export default async function MyAnnouncementsPage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [u] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const pid = u?.personId;
  const feed =
    pid == null
      ? []
      : await db
          .select({
            announcementId: announcement.announcementId,
            title: announcement.title,
            body: announcement.body,
            publishedAt: announcement.publishedAt,
          })
          .from(announcementRecipient)
          .innerJoin(
            announcement,
            eq(announcementRecipient.announcementId, announcement.announcementId)
          )
          .where(
            and(
              eq(announcementRecipient.personId, pid),
              eq(announcement.status, "PUBLISHED")
            )
          )
          .orderBy(desc(announcement.publishedAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Announcements
        </h1>
      </MotionCard>

      {feed.length === 0 ? (
        <MotionCard delay={0.05} lift={false} className="card p-6">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No announcements for you yet.
          </p>
        </MotionCard>
      ) : (
        feed.map((a, i) => (
          <MotionCard
            key={a.announcementId}
            delay={0.05 + Math.min(i, 8) * 0.06}
            className="card p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {a.title}
              </h2>
              <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {formatAnnouncementDate(a.publishedAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--text-secondary)" }}>
              {a.body}
            </p>
          </MotionCard>
        ))
      )}
    </div>
  );
}
