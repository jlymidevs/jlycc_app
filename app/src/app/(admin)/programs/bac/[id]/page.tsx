import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bacInitiative, bacSession, bacParticipant } from "@/schema/missions";
import { branch } from "@/schema/core";
import { eq, count, isNull, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BacDetailPage({ params }: { params: { id: string } }) {
  const initiativeId = Number(params.id);

  const [initiative] = await db
    .select({
      initiativeId: bacInitiative.initiativeId,
      name: bacInitiative.name,
      status: bacInitiative.status,
      startsOn: bacInitiative.startsOn,
      endsOn: bacInitiative.endsOn,
      targetCommunity: bacInitiative.targetCommunity,
      branchName: branch.name,
    })
    .from(bacInitiative)
    .leftJoin(branch, eq(bacInitiative.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bacInitiative.initiativeId, initiativeId as any));

  if (!initiative) notFound();

  const [{ participantCount }] = await db
    .select({ participantCount: count() })
    .from(bacParticipant)
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(bacParticipant.initiativeId, initiativeId as any),
        isNull(bacParticipant.leftAt),
      )
    );

  const sessions = await db
    .select({
      sessionId: bacSession.sessionId,
      sessionNumber: bacSession.sessionNumber,
      topic: bacSession.topic,
      scheduledAt: bacSession.scheduledAt,
      venue: bacSession.venue,
    })
    .from(bacSession)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bacSession.initiativeId, initiativeId as any))
    .orderBy(bacSession.sessionNumber);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/programs/bac" className="text-sm text-gray-500 hover:text-gray-900">
            ← BAC
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{initiative.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{initiative.branchName} · {initiative.status}</p>
        </div>
        <Link
          href={`/programs/bac/${initiativeId}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </Link>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{participantCount}</p>
          <p className="text-xs text-gray-500">Participants</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
          <p className="text-xs text-gray-500">Sessions</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/programs/bac/${initiativeId}/participants`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add participant
        </Link>
        <Link
          href={`/programs/bac/${initiativeId}/sessions/new`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Add session
        </Link>
      </div>

      {/* Sessions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link
                key={s.sessionId}
                href={`/programs/bac/${initiativeId}/sessions/${s.sessionId}/attendance`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Session {s.sessionNumber}{s.topic ? ` — ${s.topic}` : ""}</p>
                    {s.scheduledAt && <p className="text-xs text-gray-500 mt-0.5">{new Date(s.scheduledAt).toLocaleDateString()}{s.venue ? ` · ${s.venue}` : ""}</p>}
                  </div>
                  <span className="text-xs text-blue-600">Attendance →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
