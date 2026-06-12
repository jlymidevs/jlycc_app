// app/src/app/ministry/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { requireRole } from "@/lib/authz-server";
import { headChapterIds } from "@/actions/join-requests";
import { promoteMember } from "@/actions/promotion";
import { nextPromotionStage } from "@/lib/stage-promotion";
import RequestDecisionButtons from "@/components/request-decision-buttons";
import { ListSearch } from "@/components/members/list-search";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

const ordinal = (p: number | null) =>
  p == null ? "—" : p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : `${p}th`;

export default async function MinistryDashboardPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireRole("MINISTRY_HEAD");
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const chapters = await headChapterIds();

  if (chapters.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">My ministry</h1>
        <p className="mt-4 text-gray-600">
          You are not assigned as head of any chapter yet.
        </p>
      </div>
    );
  }

  const pendingRequests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      requestedAt: joinRequest.requestedAt,
      ministryName: ministry.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
    })
    .from(joinRequest)
    .innerJoin(member, eq(joinRequest.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(
      ministryChapter,
      eq(joinRequest.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        inArray(joinRequest.chapterId, chapters),
        eq(joinRequest.status, "PENDING")
      )
    )
    .orderBy(asc(joinRequest.requestedAt));

  const roster = await db
    .select({
      membershipId: ministryMembership.membershipId,
      chapterId: ministryMembership.chapterId,
      priority: ministryMembership.priority,
      ministryName: ministry.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      lastCheckIn: sql<Date | null>`(
        select max(ci.checked_in_at) from attendance.check_in ci
        where ci.person_id = ${member.personId}
      )`,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        inArray(ministryMembership.chapterId, chapters),
        isNull(ministryMembership.endedAt),
        query.length > 0
          ? or(
              ilike(person.firstName, `%${query}%`),
              ilike(person.lastName, `%${query}%`)
            )
          : undefined
      )
    )
    .orderBy(asc(ministry.name), desc(ministryMembership.isLeader));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My ministry</h1>
        <Link href="/me" className="text-sm text-blue-600 hover:text-blue-800">
          My profile
        </Link>
      </div>

      {/* Pending requests */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Join requests{" "}
          {pendingRequests.length > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {pendingRequests.length}
            </span>
          )}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Ministry</th>
                <th className="py-2 pr-4 font-medium">Their priority</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r) => (
                <tr key={r.requestId} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{r.currentStage}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.ministryName}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {ordinal(r.priority)} priority
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <RequestDecisionButtons requestId={r.requestId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Roster / monitoring */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">My members</h2>
          <ListSearch action="/ministry" defaultValue={query} />
        </div>
        {roster.length === 0 ? (
          <p className="text-sm text-gray-500">
            {query ? `No members match "${query}".` : "No members yet."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Ministry</th>
                <th className="py-2 pr-4 font-medium">Priority</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Last attendance</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.membershipId} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{m.ministryName}</td>
                  <td className="py-2 pr-4 text-gray-600">{ordinal(m.priority)}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.currentStage}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {m.lastCheckIn
                      ? new Date(m.lastCheckIn).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          dateStyle: "medium",
                        })
                      : "—"}
                  </td>
                  <td className="py-2">
                    {nextPromotionStage(m.currentStage) ? (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      <form action={promoteMember as any}>
                        <input type="hidden" name="membershipId" value={m.membershipId} />
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 underline">
                          Promote to {nextPromotionStage(m.currentStage) === "JOSHUA_GENERATION" ? "Joshua Generation" : "Inner Core"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
