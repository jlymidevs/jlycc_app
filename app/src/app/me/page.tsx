// app/src/app/me/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import { person } from "@/schema/core";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { hasRole, type Role } from "@/lib/authz";
import { requireRole } from "@/lib/authz-server";
import { nextStage, nextFreePriority, type StageRow } from "@/lib/journey";
import { requestJoin } from "@/actions/join-requests";
import { listActiveHeads } from "@/actions/account";
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

export default async function MePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;
  const role = (session.user!.role ?? "MEMBER") as Role;

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

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">My profile</h1>
        <p className="mt-4 text-gray-600">
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

  const memberships = await db
    .select({
      priority: ministryMembership.priority,
      ministryName: ministry.name,
      chapterId: ministryChapter.chapterId,
    })
    .from(ministryMembership)
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        eq(ministryMembership.memberId, me.memberId),
        isNull(ministryMembership.endedAt)
      )
    );

  const requests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      status: joinRequest.status,
      ministryName: ministry.name,
    })
    .from(joinRequest)
    .innerJoin(
      ministryChapter,
      eq(joinRequest.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(joinRequest.memberId, me.memberId))
    .orderBy(asc(joinRequest.priority));

  const [attendanceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const recentCheckIns = await db
    .select({
      checkInId: checkIn.checkInId,
      eventName: event.name,
      checkedInAt: checkIn.checkedInAt,
    })
    .from(checkIn)
    .innerJoin(event, eq(checkIn.eventId, event.eventId))
    .where(eq(checkIn.personId, me.personId))
    .orderBy(desc(checkIn.checkedInAt))
    .limit(10);

  const heads = await listActiveHeads();
  const memberChapterIds = new Set(memberships.map((m) => m.chapterId));
  const pendingChapterCount = requests.filter((r) => r.status === "PENDING").length;
  const taken = [
    ...memberships.map((m) => m.priority),
    ...requests.filter((r) => r.status === "PENDING").map((r) => r.priority),
  ].filter((p): p is number => p != null);
  const suggestedPriority = nextFreePriority(taken);
  const next = nextStage(ladder, me.currentStage);
  const currentStageRow = ladder.find((s) => s.stageCode === me.currentStage);

  const sortedMemberships = [...memberships].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {me.firstName} {me.lastName}
          </h1>
          <p className="text-sm text-gray-500">My christian journey</p>
        </div>
        <div className="flex gap-3 text-sm">
          {hasRole(role, "MINISTRY_HEAD") && (
            <Link href="/ministry" className="text-blue-600 hover:text-blue-800">
              Ministry dashboard
            </Link>
          )}
          {hasRole(role, "ADMIN") && (
            <Link href="/members" className="text-blue-600 hover:text-blue-800">
              Admin
            </Link>
          )}
          <Link href="/church/calendar" className="text-blue-600 hover:text-blue-800">
            Calendar
          </Link>
        </div>
      </div>

      {/* Journey ladder */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Journey</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {visibleLadder.map((s, i) => {
            const isCurrent = s.stageCode === me.currentStage;
            const passed =
              currentStageRow !== undefined &&
              s.orderIndex < currentStageRow.orderIndex;
            return (
              <li key={s.stageCode} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : passed
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s.name}
                </span>
              </li>
            );
          })}
        </ol>
        {next ? (
          <p className="text-sm text-gray-600">
            Next step: <span className="font-medium text-gray-900">{next.name}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            You are at the top of the ladder. Keep leading!
          </p>
        )}
      </section>

      {/* My attendance */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">My attendance</h2>
        {attendanceStats.total === 0 ? (
          <p className="text-sm text-gray-500">No attendance recorded yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total", value: String(attendanceStats.total) },
                { label: "This year", value: String(attendanceStats.thisYear) },
                { label: "Last attended", value: attendanceStats.lastAttended ?? "—" },
              ].map((card) => (
                <div key={card.label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-gray-100">
              {recentCheckIns.map((c) => (
                <li
                  key={c.checkInId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-gray-900">{c.eventName}</span>
                  <span className="text-gray-500">
                    {c.checkedInAt.toISOString().split("T")[0]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* My ministries */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">My ministries</h2>
        {sortedMemberships.length === 0 ? (
          <p className="text-sm text-gray-500">No ministries yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedMemberships.map((m) => (
              <li key={m.chapterId} className="flex items-center gap-3 py-2 text-sm">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  {m.priority ?? "—"}
                </span>
                <span className="text-gray-900">{m.ministryName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Join a ministry */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Join a ministry</h2>

        {requests.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {requests.map((r) => (
              <li
                key={r.requestId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-gray-900">
                  #{r.priority} — {r.ministryName}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "PENDING"
                      ? "bg-yellow-50 text-yellow-700"
                      : r.status === "APPROVED"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        {heads.filter((h) => !memberChapterIds.has(h.chapterId)).length === 0 ? (
          <p className="text-sm text-gray-500">
            No ministries available to join right now.
          </p>
        ) : (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          <form action={requestJoin as any} className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ministry
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {heads
                  .filter((h) => !memberChapterIds.has(h.chapterId))
                  .map((h) => (
                    <option key={h.chapterId} value={h.chapterId}>
                      {h.ministryName} — {h.headFirstName} {h.headLastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <input
                name="priority"
                type="number"
                min="1"
                defaultValue={suggestedPriority}
                required
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Request to join
            </button>
          </form>
        )}
        {pendingChapterCount > 0 && (
          <p className="text-xs text-gray-400">
            Requests are approved by the ministry head.
          </p>
        )}
      </section>
    </div>
  );
}
