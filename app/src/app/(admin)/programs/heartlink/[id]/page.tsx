import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { heartlinkCohort, heartlinkEnrollment, heartlinkSession } from "@/schema/programs";
import { branch } from "@/schema/core";
import { eq, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const cohortId = Number(params.id);

  const [cohort] = await db
    .select({
      cohortId: heartlinkCohort.cohortId,
      name: heartlinkCohort.name,
      status: heartlinkCohort.status,
      startsOn: heartlinkCohort.startsOn,
      endsOn: heartlinkCohort.endsOn,
      sessionCount: heartlinkCohort.sessionCount,
      branchName: branch.name,
    })
    .from(heartlinkCohort)
    .leftJoin(branch, eq(heartlinkCohort.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkCohort.cohortId, cohortId as any));

  if (!cohort) notFound();

  const [{ enrolleeCount }] = await db
    .select({ enrolleeCount: count() })
    .from(heartlinkEnrollment)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkEnrollment.cohortId, cohortId as any));

  const sessions = await db
    .select({
      sessionId: heartlinkSession.sessionId,
      sessionNumber: heartlinkSession.sessionNumber,
      topic: heartlinkSession.topic,
      scheduledAt: heartlinkSession.scheduledAt,
      venue: heartlinkSession.venue,
    })
    .from(heartlinkSession)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkSession.cohortId, cohortId as any))
    .orderBy(heartlinkSession.sessionNumber);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/programs/heartlink" className="text-sm text-gray-500 hover:text-gray-900">
            ← Heartlink
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{cohort.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cohort.branchName} · {cohort.status}</p>
        </div>
        <Link
          href={`/programs/heartlink/${cohortId}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </Link>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{enrolleeCount}</p>
          <p className="text-xs text-gray-500">Enrollees</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
          <p className="text-xs text-gray-500">Sessions</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/programs/heartlink/${cohortId}/enroll`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Enroll person
        </Link>
        <Link
          href={`/programs/heartlink/${cohortId}/sessions/new`}
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
                href={`/programs/heartlink/${cohortId}/sessions/${s.sessionId}/attendance`}
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
