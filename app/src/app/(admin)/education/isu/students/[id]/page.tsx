// app/src/app/(admin)/education/isu/students/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isuStudent, isuTrack, isuTrackProgression } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc } from "drizzle-orm";
import { progressTrack } from "@/actions/education-isu";

export const dynamic = "force-dynamic";

export default async function IsuStudentDetailPage({ params }: { params: { id: string } }) {
  const studentId = Number(params.id);

  const [student] = await db
    .select({
      studentId: isuStudent.studentId,
      enrolledOn: isuStudent.enrolledOn,
      status: isuStudent.status,
      firstName: person.firstName,
      lastName: person.lastName,
      currentTrackName: isuTrack.name,
      currentTrackId: isuStudent.currentTrackId,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(isuTrack, eq(isuStudent.currentTrackId, isuTrack.trackId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));

  if (!student) notFound();

  const progressions = await db
    .select({
      progressionId: isuTrackProgression.progressionId,
      progressedAt: isuTrackProgression.progressedAt,
      notes: isuTrackProgression.notes,
      toTrackName: isuTrack.name,
    })
    .from(isuTrackProgression)
    .innerJoin(isuTrack, eq(isuTrackProgression.toTrackId, isuTrack.trackId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuTrackProgression.studentId, studentId as any))
    .orderBy(desc(isuTrackProgression.progressedAt));

  const allTracks = await db
    .select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
    .from(isuTrack)
    .orderBy(isuTrack.orderIndex);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/isu/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{student.firstName} {student.lastName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Current track: {student.currentTrackName ?? "None"} · {student.status}
        </p>
      </div>

      {/* Progress track form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Progress to track</h2>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form action={progressTrack.bind(null, studentId) as any} className="flex gap-3 items-end">
          <div className="flex-1">
            <select name="toTrackId" required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select track…</option>
              {allTracks.map((t) => (
                <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
              ))}
            </select>
          </div>
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Progress
          </button>
        </form>
      </section>

      {/* Track progression history */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Track history ({progressions.length})</h2>
        {progressions.length === 0 ? (
          <p className="text-sm text-gray-500">No track progressions yet.</p>
        ) : (
          <div className="space-y-2">
            {progressions.map((p) => (
              <div key={p.progressionId} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-gray-400 text-xs">{new Date(p.progressedAt).toLocaleDateString()}</span>
                <span>→ {p.toTrackName}</span>
                {p.notes && <span className="text-gray-400 text-xs">({p.notes})</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
