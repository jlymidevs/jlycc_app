import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { bacSession, bacParticipant, bacSessionAttendance, bacInitiative } from "@/schema/missions";
import { person } from "@/schema/core";
import { eq, and, isNull } from "drizzle-orm";
import { markBacAttendance } from "@/actions/bac";
import BacQrScanner from "@/components/BacQrScanner";

export const dynamic = "force-dynamic";

export default async function BacAttendancePage({
  params,
}: {
  params: { id: string; sid: string };
}) {
  const initiativeId = Number(params.id);
  const sessionId = Number(params.sid);

  const [session] = await db
    .select({
      sessionId: bacSession.sessionId,
      sessionNumber: bacSession.sessionNumber,
      topic: bacSession.topic,
      initiativeName: bacInitiative.name,
    })
    .from(bacSession)
    .innerJoin(bacInitiative, eq(bacSession.initiativeId, bacInitiative.initiativeId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bacSession.sessionId, sessionId as any));

  if (!session) notFound();

  const participants = await db
    .select({
      personId: bacParticipant.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: bacSessionAttendance.attended,
    })
    .from(bacParticipant)
    .innerJoin(person, eq(bacParticipant.personId, person.personId))
    .leftJoin(
      bacSessionAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(bacSessionAttendance.sessionId, sessionId as any),
        eq(bacSessionAttendance.personId, bacParticipant.personId),
      )
    )
    .where(
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(bacParticipant.initiativeId, initiativeId as any),
        isNull(bacParticipant.leftAt),
      )
    );

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href={`/programs/bac/${initiativeId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {session.initiativeName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Session {session.sessionNumber} Attendance
          {session.topic ? ` — ${session.topic}` : ""}
        </h1>
      </div>

      {/* Checklist */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Participants ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-gray-500">No participants yet.</p>
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
                {participants.map((p) => (
                  <tr key={p.personId}>
                    <td className="px-4 py-3 text-gray-900">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={() => void markBacAttendance(sessionId, p.personId, true)}>
                        <button
                          type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            p.attended === true
                              ? "bg-green-100 text-green-700"
                              : "border border-gray-200 text-gray-500 hover:bg-green-50"
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={() => void markBacAttendance(sessionId, p.personId, false)}>
                        <button
                          type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            p.attended === false
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
        <BacQrScanner initiativeId={initiativeId} sessionId={sessionId} />
      </section>
    </div>
  );
}
