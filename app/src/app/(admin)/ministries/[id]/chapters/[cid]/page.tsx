// app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getChapter,
  searchMembers,
  updateChapterStatus,
  addMember,
  endMembership,
  setLeaderRole,
} from "@/actions/ministries";
import { ListSearch } from "@/components/members/list-search";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const LEADER_ROLE_LABELS: Record<string, string> = {
  HEAD: "Head",
  ASSISTANT_HEAD: "Asst. Head",
  COORDINATOR: "Coordinator",
};

export default async function ChapterDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; cid: string };
  searchParams: { q?: string; rq?: string; addErr?: string; endErr?: string; leaderErr?: string };
}) {
  const ministryId = Number(params.id);
  const chapterId = Number(params.cid);

  const chapter = await getChapter(chapterId);
  if (!chapter) notFound();

  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const memberResults = query.length >= 2 ? await searchMembers(query) : [];

  const rosterQuery = typeof searchParams.rq === "string" ? searchParams.rq.trim() : "";
  const rosterLower = rosterQuery.toLowerCase();
  const visibleMembers =
    rosterLower.length > 0
      ? chapter.activeMembers.filter(
          (m) =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(rosterLower) ||
            (m.memberCode ?? "").toLowerCase().includes(rosterLower)
        )
      : chapter.activeMembers;

  const addErr =
    typeof searchParams.addErr === "string" ? searchParams.addErr : undefined;
  const endErr =
    typeof searchParams.endErr === "string" ? searchParams.endErr : undefined;
  const leaderErr =
    typeof searchParams.leaderErr === "string" ? searchParams.leaderErr : undefined;

  // ── Server actions ──────────────────────────────────────────────────────

  async function handleUpdateStatus(formData: FormData) {
    "use server";
    const status = formData.get("status") as "ACTIVE" | "PAUSED" | "CLOSED";
    await updateChapterStatus(chapterId, status);
    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleAddMember(formData: FormData) {
    "use server";
    const memberId = Number(formData.get("memberId"));
    const joinedAt = formData.get("joinedAt") as string;
    const leaderRole = formData.get("leaderRole") as string | null;
    const isLeader = !!(leaderRole && leaderRole.trim().length > 0);

    const result = await addMember({
      chapterId,
      memberId,
      joinedAt,
      isLeader,
      leaderRole: isLeader
        ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR")
        : undefined,
    });

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?q=${encodeURIComponent(query)}&addErr=${encodeURIComponent(result.error)}`
      );
    }

    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleEndMembership(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const endedAt = formData.get("endedAt") as string;
    const endedReason = formData.get("endedReason") as string | null;

    const result = await endMembership({
      membershipId,
      endedAt,
      endedReason: endedReason || undefined,
    });

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?endErr=${encodeURIComponent(result.error)}`
      );
    }

    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  async function handleSetLeader(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const leaderRole = formData.get("leaderRole") as string | null;
    const isLeader = !!(leaderRole && leaderRole.trim().length > 0);

    const result = await setLeaderRole(
      membershipId,
      isLeader,
      isLeader ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR") : undefined
    );

    if ("error" in result) {
      redirect(
        `/ministries/${ministryId}/chapters/${chapterId}?leaderErr=${encodeURIComponent(result.error)}`
      );
    }

    redirect(`/ministries/${ministryId}/chapters/${chapterId}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/ministries/${ministryId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← {chapter.ministryName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {chapter.branchName} Chapter
        </h1>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium mt-1 ${
            STATUS_COLORS[chapter.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {chapter.status}
        </span>
      </div>

      {/* Status control */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">Change Status</h2>
        <form action={handleUpdateStatus} className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={chapter.status}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Update
          </button>
        </form>
      </section>

      {/* Active Members */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Active Members ({chapter.activeMembers.length})
          </h2>
          <ListSearch
            action={`/ministries/${ministryId}/chapters/${chapterId}`}
            paramName="rq"
            defaultValue={rosterQuery}
            placeholder="Filter by name or code…"
            preserveParams={{ q: query }}
          />
        </div>

        {endErr && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error ending membership: {endErr}
          </p>
        )}
        {leaderErr && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error updating leader: {leaderErr}
          </p>
        )}

        {visibleMembers.length === 0 ? (
          <p className="text-sm text-gray-500">
            {rosterQuery
              ? `No active members match "${rosterQuery}".`
              : "No active members."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Member
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Joined
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleMembers.map((m) => (
                  <tr key={m.membershipId} className="bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{m.memberCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(m.joinedAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {m.isLeader && m.leaderRole ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          {LEADER_ROLE_LABELS[m.leaderRole] ?? m.leaderRole}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {/* Set/Remove Leader */}
                        {m.isLeader ? (
                          <form action={handleSetLeader}>
                            <input
                              type="hidden"
                              name="membershipId"
                              value={m.membershipId}
                            />
                            {/* no leaderRole submitted → isLeader derived as false */}
                            <button
                              type="submit"
                              className="text-xs text-amber-600 hover:text-amber-800 underline"
                            >
                              Remove leader
                            </button>
                          </form>
                        ) : (
                          <form action={handleSetLeader} className="flex items-center gap-1">
                            <input
                              type="hidden"
                              name="membershipId"
                              value={m.membershipId}
                            />
                            {/* leaderRole presence → isLeader derived as true */}
                            <select
                              name="leaderRole"
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="HEAD">Head</option>
                              <option value="ASSISTANT_HEAD">Asst. Head</option>
                              <option value="COORDINATOR">Coordinator</option>
                            </select>
                            <button
                              type="submit"
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Set leader
                            </button>
                          </form>
                        )}

                        {/* End membership */}
                        <form action={handleEndMembership} className="flex items-center gap-1">
                          <input
                            type="hidden"
                            name="membershipId"
                            value={m.membershipId}
                          />
                          <input type="hidden" name="endedAt" value={today} />
                          <button
                            type="submit"
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            End
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Member */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Add Member</h2>

        {addErr === "member_already_active" && (
          <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
            That member is already active in this chapter.
          </p>
        )}
        {addErr && addErr !== "member_already_active" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error: {addErr}
          </p>
        )}

        {/* Member search */}
        <form method="GET" className="flex items-center gap-2">
          {rosterQuery.length > 0 && (
            <input type="hidden" name="rq" value={rosterQuery} />
          )}
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search member by name or code…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Search
          </button>
        </form>

        {query.length >= 2 && memberResults.length === 0 && (
          <p className="text-sm text-gray-500">No members found for &quot;{query}&quot;.</p>
        )}

        {memberResults.length > 0 && (
          <div className="space-y-2">
            {memberResults.map((r) => (
              <form
                key={r.memberId}
                action={handleAddMember}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <input type="hidden" name="memberId" value={r.memberId} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{r.memberCode}</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Joined
                  </label>
                  <input
                    type="date"
                    name="joinedAt"
                    defaultValue={today}
                    required
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Leader role
                  </label>
                  <select
                    name="leaderRole"
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    <option value="HEAD">Head</option>
                    <option value="ASSISTANT_HEAD">Asst. Head</option>
                    <option value="COORDINATOR">Coordinator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
