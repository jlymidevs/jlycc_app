// app/src/app/(admin)/education/isu/students/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuStudent, isuTrack } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function IsuStudentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type IsuStatus = "ACTIVE" | "INACTIVE" | "COMPLETED";
  const statusValues: IsuStatus[] =
    statusFilter === "all" ? ["ACTIVE", "INACTIVE", "COMPLETED"] :
    statusFilter === "completed" ? ["COMPLETED"] :
    ["ACTIVE"];

  const students = await db
    .select({
      studentId: isuStudent.studentId,
      enrolledOn: isuStudent.enrolledOn,
      status: isuStudent.status,
      firstName: person.firstName,
      lastName: person.lastName,
      trackName: isuTrack.name,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(isuTrack, eq(isuStudent.currentTrackId, isuTrack.trackId))
    .where(inArray(isuStudent.status, statusValues))
    .orderBy(desc(isuStudent.studentId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ISU Students</h1>
        <Link
          href="/education/isu/students/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register student
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "completed", "all"] as const).map((s) => (
          <Link key={s} href={`/education/isu/students?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students found.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Current track</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/education/isu/students/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.trackName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <Link href="/education/isu/sessions" className="text-sm text-blue-600 hover:underline">
          View sessions →
        </Link>
        <Link href="/education/bc/students" className="text-sm text-blue-600 hover:underline">
          Switch to BC →
        </Link>
      </div>
    </div>
  );
}
