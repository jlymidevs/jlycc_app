// app/src/app/network-head/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { network, ministry, ministryChapter, ministryMembership } from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { myNetworkIds, setChapterHeadAsNetworkHead } from "@/actions/network-leaders";
import { ListSearch } from "@/components/members/list-search";
import { and, asc, eq, inArray, isNull, or, ilike } from "drizzle-orm";

export default async function NetworkHeadPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireRole("NETWORK_HEAD");
  const nets = await myNetworkIds();
  if (nets.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-6 md:px-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Network Dashboard</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          You are not assigned as head of any network.
        </p>
      </div>
    );
  }
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const [net] = await db
    .select({ name: network.name, description: network.description })
    .from(network)
    .where(inArray(network.networkId, nets))
    .limit(1);

  const rows = await db
    .select({
      membershipId: ministryMembership.membershipId,
      ministryName: ministry.name,
      branchName: branch.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      isLeader: ministryMembership.isLeader,
      leaderRole: ministryMembership.leaderRole,
    })
    .from(ministryMembership)
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        inArray(ministry.networkId, nets),
        isNull(ministryMembership.endedAt),
        query.length > 0
          ? or(ilike(person.firstName, `%${query}%`), ilike(person.lastName, `%${query}%`))
          : undefined
      )
    )
    .orderBy(asc(ministry.name), asc(person.lastName));

  const eligible = (stage: string) => stage === "INNER_CORE" || stage === "JOSHUA_GENERATION";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {net?.name} Network
        </h1>
        {net?.description && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{net.description}</p>
        )}
      </div>

      <div className="card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Members &amp; Ministry Heads
          </h2>
          <ListSearch action="/network-head" defaultValue={query} variant="lime" />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {query ? `No members match "${query}".` : "No members in your network yet."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Ministry / Branch</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.membershipId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {r.ministryName} — {r.branchName}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{r.currentStage}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {r.isLeader && r.leaderRole === "HEAD" ? "Ministry Head" : "Member"}
                  </td>
                  <td className="py-2">
                    {r.isLeader && r.leaderRole === "HEAD" ? (
                      <form action={setChapterHeadAsNetworkHead as unknown as (formData: FormData) => void}>
                        <input type="hidden" name="membershipId" value={r.membershipId} />
                        <input type="hidden" name="makeHead" value="0" />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
                          Remove head
                        </button>
                      </form>
                    ) : eligible(r.currentStage) ? (
                      <form action={setChapterHeadAsNetworkHead as unknown as (formData: FormData) => void}>
                        <input type="hidden" name="membershipId" value={r.membershipId} />
                        <input type="hidden" name="makeHead" value="1" />
                        <button type="submit" className="text-xs underline" style={{ color: "var(--text-primary)" }}>
                          Appoint head
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>not eligible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
