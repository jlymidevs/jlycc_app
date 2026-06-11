// app/src/app/me/attendance/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
import { requireRole } from "@/lib/authz-server";
import { desc, eq, sql } from "drizzle-orm";
import MotionCard from "@/components/motion-card";
import AnimatedNumber from "@/components/animated-number";

const manilaDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
});

export default async function MyAttendancePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({ personId: member.personId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p style={{ color: "var(--text-secondary)" }}>
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const recent = await db
    .select({
      checkInId: checkIn.checkInId,
      eventName: event.name,
      checkedInAt: checkIn.checkedInAt,
    })
    .from(checkIn)
    .innerJoin(event, eq(checkIn.eventId, event.eventId))
    .where(eq(checkIn.personId, me.personId))
    .orderBy(desc(checkIn.checkedInAt))
    .limit(25);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My attendance
        </h1>
      </MotionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MotionCard delay={0.05} className="card-lime px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Total</p>
          <p className="stat-number mt-1 text-3xl">
            <AnimatedNumber value={stats.total} />
          </p>
        </MotionCard>
        <MotionCard delay={0.11} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            This year
          </p>
          <p className="stat-number mt-1 text-3xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={stats.thisYear} />
          </p>
        </MotionCard>
        <MotionCard delay={0.17} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Last attended
          </p>
          <p className="stat-number mt-1 text-lg leading-9" style={{ color: "var(--text-primary)" }}>
            {stats.lastAttended ?? "—"}
          </p>
        </MotionCard>
      </div>

      <MotionCard delay={0.23} lift={false} className="card p-6">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Recent check-ins
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            No attendance recorded yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.map((c) => (
              <li key={c.checkInId} className="flex items-center justify-between py-2 text-sm">
                <span style={{ color: "var(--text-primary)" }}>{c.eventName}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {manilaDate.format(c.checkedInAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </MotionCard>
    </div>
  );
}
