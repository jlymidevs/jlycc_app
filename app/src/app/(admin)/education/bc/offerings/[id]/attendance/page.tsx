// app/src/app/(admin)/education/bc/offerings/[id]/attendance/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  bcCourseOffering, bcCourse, bcSemester, bcEnrollment, bcStudent, bcClassAttendance,
} from "@/schema/education";
import { person } from "@/schema/core";
import { eq, and } from "drizzle-orm";
import { recordClassAttendance } from "@/actions/education-bc";

export const dynamic = "force-dynamic";

export default async function BcClassAttendancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const offeringId = Number(params.id);
  const classDate = searchParams.date ?? new Date().toISOString().split("T")[0];

  const [offering] = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      courseCode: bcCourse.code,
      courseTitle: bcCourse.title,
      semesterName: bcSemester.name,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcCourseOffering.offeringId, offeringId as any));

  if (!offering) notFound();

  const students = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: bcClassAttendance.attended,
    })
    .from(bcEnrollment)
    .innerJoin(bcStudent, eq(bcEnrollment.studentId, bcStudent.studentId))
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .leftJoin(
      bcClassAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(bcClassAttendance.offeringId, offeringId as any),
        eq(bcClassAttendance.studentId, bcStudent.studentId),
        eq(bcClassAttendance.classDate, classDate),
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/education/bc/offerings/${offeringId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {offering.courseCode} {offering.courseTitle}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Class Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">{offering.semesterName}</p>
      </div>

      {/* Date picker */}
      <form method="GET" className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class date</label>
          <input
            name="date"
            type="date"
            defaultValue={classDate}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Load
        </button>
      </form>

      {/* Attendance checklist */}
      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students enrolled.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-center font-medium text-gray-700">Present</th>
                <th className="px-4 py-2 text-center font-medium text-gray-700">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td className="px-4 py-3 text-gray-900">{s.firstName} {s.lastName} <span className="text-xs text-gray-400">#{s.studentNumber}</span></td>
                  <td className="px-4 py-3 text-center">
                    <form action={(fd) => void recordClassAttendance(offeringId, fd)}>
                      <input type="hidden" name="studentId" value={s.studentId} />
                      <input type="hidden" name="classDate" value={classDate} />
                      <input type="hidden" name="attended" value="true" />
                      <button type="submit"
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          s.attended === true ? "bg-green-100 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-green-50"
                        }`}>
                        ✓
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <form action={(fd) => void recordClassAttendance(offeringId, fd)}>
                      <input type="hidden" name="studentId" value={s.studentId} />
                      <input type="hidden" name="classDate" value={classDate} />
                      <input type="hidden" name="attended" value="false" />
                      <button type="submit"
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          s.attended === false ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-500 hover:bg-red-50"
                        }`}>
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
    </div>
  );
}
