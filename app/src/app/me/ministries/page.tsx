// app/src/app/me/ministries/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { requireRole } from "@/lib/authz-server";
import { nextFreePriority } from "@/lib/journey";
import { requestJoin } from "@/actions/join-requests";
import { listActiveHeads } from "@/actions/account";
import { and, asc, eq, isNull } from "drizzle-orm";
import MotionCard from "@/components/motion-card";

export default async function MyMinistriesPage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({ memberId: member.memberId })
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

  const memberships = await db
    .select({
      priority: ministryMembership.priority,
      ministryName: ministry.name,
      chapterId: ministryChapter.chapterId,
    })
    .from(ministryMembership)
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(and(eq(ministryMembership.memberId, me.memberId), isNull(ministryMembership.endedAt)));

  const requests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      status: joinRequest.status,
      ministryName: ministry.name,
    })
    .from(joinRequest)
    .innerJoin(ministryChapter, eq(joinRequest.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(joinRequest.memberId, me.memberId))
    .orderBy(asc(joinRequest.priority));

  const heads = await listActiveHeads();
  const memberChapterIds = new Set(memberships.map((m) => m.chapterId));
  const taken = [
    ...memberships.map((m) => m.priority),
    ...requests.filter((r) => r.status === "PENDING").map((r) => r.priority),
  ].filter((p): p is number => p != null);
  const suggestedPriority = nextFreePriority(taken);
  const sortedMemberships = [...memberships].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  );
  const joinable = heads.filter((h) => !memberChapterIds.has(h.chapterId));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My ministries
        </h1>
      </MotionCard>

      <MotionCard delay={0.05} lift={false} className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Memberships
        </h2>
        {sortedMemberships.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No ministries yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {sortedMemberships.map((m) => (
              <li key={m.chapterId} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
                >
                  {m.priority ?? "—"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>{m.ministryName}</span>
              </li>
            ))}
          </ul>
        )}
      </MotionCard>

      <MotionCard delay={0.1} lift={false} className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Join a ministry
        </h2>

        {requests.length > 0 && (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {requests.map((r) => (
              <li key={r.requestId} className="flex items-center justify-between py-2 text-sm">
                <span style={{ color: "var(--text-primary)" }}>
                  #{r.priority} — {r.ministryName}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-300 ${
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

        {joinable.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No ministries available to join right now.
          </p>
        ) : (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          <form action={requestJoin as any} className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Ministry
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {joinable.map((h) => (
                  <option key={h.chapterId} value={h.chapterId}>
                    {h.ministryName} — {h.headFirstName} {h.headLastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
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
              className="btn-lime rounded-md px-4 py-2 text-sm font-medium"
            >
              Request to join
            </button>
          </form>
        )}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Requests are approved by the ministry head.
        </p>
      </MotionCard>
    </div>
  );
}
