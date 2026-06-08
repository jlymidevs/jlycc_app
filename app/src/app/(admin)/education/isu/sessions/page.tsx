// app/src/app/(admin)/education/isu/sessions/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuSession, isuTrack } from "@/schema/education";
import { branch } from "@/schema/core";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function IsuSessionsPage() {
  const sessions = await db
    .select({
      sessionId: isuSession.sessionId,
      topic: isuSession.topic,
      scheduledAt: isuSession.scheduledAt,
      trackName: isuTrack.name,
      trackCode: isuTrack.code,
      branchName: branch.name,
    })
    .from(isuSession)
    .innerJoin(isuTrack, eq(isuSession.trackId, isuTrack.trackId))
    .innerJoin(branch, eq(isuSession.branchId, branch.branchId))
    .orderBy(desc(isuSession.sessionId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ISU Sessions</h1>
        <Link
          href="/education/isu/sessions/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link key={s.sessionId} href={`/education/isu/sessions/${s.sessionId}/attendance`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {s.trackCode} — {s.trackName}{s.topic ? `: ${s.topic}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.branchName}{s.scheduledAt ? ` · ${new Date(s.scheduledAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="text-xs text-blue-600">Attendance →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
