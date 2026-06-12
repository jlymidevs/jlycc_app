// app/src/app/me/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import { person } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { nextStage, type StageRow } from "@/lib/journey";
import { greetingForHour, manilaHour } from "@/lib/greeting";
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import MotionCard from "@/components/motion-card";
import AnimatedNumber from "@/components/animated-number";
import JourneyLadder from "@/components/journey-ladder";

export default async function MePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({
      memberId: member.memberId,
      personId: member.personId,
      currentStage: member.currentStage,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.email, email))
    .limit(1);

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My profile
        </h1>
        <p className="mt-4" style={{ color: "var(--text-secondary)" }}>
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

  const ladder: StageRow[] = await db
    .select({
      stageCode: lifecycleStage.stageCode,
      name: lifecycleStage.name,
      orderIndex: lifecycleStage.orderIndex,
      isTerminal: lifecycleStage.isTerminal,
    })
    .from(lifecycleStage)
    .where(eq(lifecycleStage.isActive, true))
    .orderBy(asc(lifecycleStage.orderIndex));
  const visibleLadder = ladder.filter((s) => !s.isTerminal);

  const [attendanceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const [nextEvent] = await db
    .select({ eventId: event.eventId, name: event.name, startsAt: event.startsAt })
    .from(event)
    .where(
      and(
        gt(event.startsAt, sql`now()`),
        inArray(event.status, ["SCHEDULED", "IN_PROGRESS"] as ("SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED")[]),
      )
    )
    .orderBy(asc(event.startsAt))
    .limit(1);

  const next = nextStage(ladder, me.currentStage);
  const greeting = greetingForHour(manilaHour(new Date()));
  const stageName =
    ladder.find((s) => s.stageCode === me.currentStage)?.name ?? me.currentStage;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {greeting}, {me.firstName}
          </h1>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
          >
            {stageName}
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          My christian journey
        </p>
      </MotionCard>

      {/* Journey */}
      <MotionCard delay={0.05} lift={false} className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Journey
        </h2>
        <JourneyLadder stages={visibleLadder} currentCode={me.currentStage} />
        {next ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Next step:{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {next.name}
            </span>
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            You are at the top of the ladder. Keep leading!
          </p>
        )}
      </MotionCard>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MotionCard delay={0.1} className="card-lime px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Total check-ins</p>
          <p className="stat-number mt-1 text-3xl">
            <AnimatedNumber value={attendanceStats.total} />
          </p>
        </MotionCard>
        <MotionCard delay={0.16} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            This year
          </p>
          <p className="stat-number mt-1 text-3xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={attendanceStats.thisYear} />
          </p>
        </MotionCard>
        <MotionCard delay={0.22} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Last attended
          </p>
          <p className="stat-number mt-1 text-lg leading-9" style={{ color: "var(--text-primary)" }}>
            {attendanceStats.lastAttended ?? "—"}
          </p>
        </MotionCard>
      </div>

      {/* Next event + quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MotionCard delay={0.28} className="card p-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Next event
          </h2>
          {nextEvent ? (
            <div className="mt-3">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {nextEvent.name}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(nextEvent.startsAt)}
              </p>
              <Link href="/me/calendar" className="mt-2 inline-block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                View calendar →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
              No upcoming events scheduled.
            </p>
          )}
        </MotionCard>
        <MotionCard delay={0.34} className="card p-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Quick actions
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/me/attendance" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                View my attendance →
              </Link>
            </li>
            <li>
              <Link href="/me/ministries" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                Manage my ministries →
              </Link>
            </li>
            <li>
              <Link href="/me/announcements" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                Read announcements →
              </Link>
            </li>
          </ul>
        </MotionCard>
      </div>
    </div>
  );
}
