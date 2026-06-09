import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { heartlinkSession, heartlinkEnrollment, heartlinkSessionAttendance, heartlinkCohort } from "@/schema/programs";
import { person } from "@/schema/core";
import { eq, and } from "drizzle-orm";
import { markHeartlinkAttendance } from "@/actions/programs";
import HeartlinkQrScanner from "@/components/HeartlinkQrScanner";

export const dynamic = "force-dynamic";

export default async function HeartlinkAttendancePage({
  params,
}: {
  params: { id: string; sid: string };
}) {
  const cohortId = Number(params.id);
  const sessionId = Number(params.sid);

  const [session] = await db
    .select({
      sessionId: heartlinkSession.sessionId,
      sessionNumber: heartlinkSession.sessionNumber,
      topic: heartlinkSession.topic,
      cohortName: heartlinkCohort.name,
    })
    .from(heartlinkSession)
    .innerJoin(heartlinkCohort, eq(heartlinkSession.cohortId, heartlinkCohort.cohortId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkSession.sessionId, sessionId as any));

  if (!session) notFound();

  // enrollees with their current attendance for this session
  const enrollees = await db
    .select({
      enrollmentId: heartlinkEnrollment.enrollmentId,
      personId: person.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: heartlinkSessionAttendance.attended,
    })
    .from(heartlinkEnrollment)
    .innerJoin(person, eq(heartlinkEnrollment.personId, person.personId))
    .leftJoin(
      heartlinkSessionAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(heartlinkSessionAttendance.sessionId, sessionId as any),
        eq(heartlinkSessionAttendance.enrollmentId, heartlinkEnrollment.enrollmentId),
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(heartlinkEnrollment.cohortId, cohortId as any));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href={`/programs/heartlink/${cohortId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {session.cohortName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Session {session.sessionNumber} Attendance
          {session.topic ? ` — ${session.topic}` : ""}
        </h1>
      </div>

      {/* Checklist */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Enrollees ({enrollees.length})</h2>
        {enrollees.length === 0 ? (
          <p className="text-sm text-gray-500">No enrollees yet.</p>
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
                {enrollees.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td className="px-4 py-3 text-gray-900">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={markHeartlinkAttendance.bind(null, sessionId, e.enrollmentId, true) as any}>
                        <button
                          type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            e.attended === true
                              ? "bg-green-100 text-green-700"
                              : "border border-gray-200 text-gray-500 hover:bg-green-50"
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={markHeartlinkAttendance.bind(null, sessionId, e.enrollmentId, false) as any}>
                        <button
                          type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            e.attended === false
                              ? "bg-red-100 text-red-700"
                              : "border border-gray-200 text-gray-500 hover:bg-red-50"
                          }`}
                        >
                          ✗
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* QR Scanner */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">QR Check-in</h2>
        <HeartlinkQrScanner sessionId={sessionId} />
      </section>
    </div>
  );
}
