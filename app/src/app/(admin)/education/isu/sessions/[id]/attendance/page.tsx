// app/src/app/(admin)/education/isu/sessions/[id]/attendance/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isuSession, isuTrack, isuStudent, isuSessionAttendance } from "@/schema/education";
import { branch, person } from "@/schema/core";
import { eq, and } from "drizzle-orm";
import { markIsuAttendance } from "@/actions/education-isu";

export const dynamic = "force-dynamic";

export default async function IsuSessionAttendancePage({ params }: { params: { id: string } }) {
  const sessionId = Number(params.id);

  const [session] = await db
    .select({
      sessionId: isuSession.sessionId,
      topic: isuSession.topic,
      scheduledAt: isuSession.scheduledAt,
      trackName: isuTrack.name,
      trackCode: isuTrack.code,
      trackId: isuSession.trackId,
      branchName: branch.name,
    })
    .from(isuSession)
    .innerJoin(isuTrack, eq(isuSession.trackId, isuTrack.trackId))
    .innerJoin(branch, eq(isuSession.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuSession.sessionId, sessionId as any));

  if (!session) notFound();

  // active ISU students on this track
  const students = await db
    .select({
      personId: isuStudent.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: isuSessionAttendance.attended,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(
      isuSessionAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(isuSessionAttendance.sessionId, sessionId as any),
        eq(isuSessionAttendance.personId, isuStudent.personId),
      )
    )
    .where(and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(isuStudent.currentTrackId, session.trackId as any),
      eq(isuStudent.status, "ACTIVE"),
    ));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/isu/sessions" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Sessions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {session.trackCode} Attendance
          {session.topic ? ` — ${session.topic}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {session.branchName}{session.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Students on this track ({students.length})</h2>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">No active students on this track.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Present</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.personId}>
                    <td className="px-4 py-3 text-gray-900">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-center">
                      <form action={(fd) => void markIsuAttendance(sessionId, s.personId, true)}>
                        <button type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            s.attended === true ? "bg-green-100 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-green-50"
                          }`}>✓</button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={(fd) => void markIsuAttendance(sessionId, s.personId, false)}>
                        <button type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            s.attended === false ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-500 hover:bg-red-50"
                          }`}>✗</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
