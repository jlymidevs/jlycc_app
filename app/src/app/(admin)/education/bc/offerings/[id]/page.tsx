// app/src/app/(admin)/education/bc/offerings/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  bcCourseOffering, bcCourse, bcSemester, bcEnrollment, bcStudent,
} from "@/schema/education";
import { person } from "@/schema/core";
import { eq, count } from "drizzle-orm";
import { enrollInOffering } from "@/actions/education-bc";

export const dynamic = "force-dynamic";

export default async function BcOfferingDetailPage({ params }: { params: { id: string } }) {
  const offeringId = Number(params.id);

  const [offering] = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      venue: bcCourseOffering.venue,
      maxSeats: bcCourseOffering.maxSeats,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcCourseOffering.offeringId, offeringId as any));

  if (!offering) notFound();

  const [{ enrolledCount }] = await db
    .select({ enrolledCount: count() })
    .from(bcEnrollment)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  const enrollments = await db
    .select({
      enrollmentId: bcEnrollment.enrollmentId,
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcEnrollment.status,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(bcEnrollment)
    .innerJoin(bcStudent, eq(bcEnrollment.studentId, bcStudent.studentId))
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/education/bc/offerings" className="text-sm text-gray-500 hover:text-gray-900">
            ← Offerings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{offering.courseCode} — {offering.courseTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{offering.semesterName}{offering.venue ? ` · ${offering.venue}` : ""}</p>
        </div>
        <Link
          href={`/education/bc/offerings/${offeringId}/attendance`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Attendance
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{enrolledCount}</p>
          <p className="text-xs text-gray-500">Enrolled</p>
        </div>
        {offering.maxSeats && (
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{offering.maxSeats}</p>
            <p className="text-xs text-gray-500">Max seats</p>
          </div>
        )}
      </div>

      {/* Enroll student form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Enroll a student</h2>
        <form action={(fd) => void enrollInOffering(offeringId, fd)} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input name="studentId" type="number" required min="1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enrolled on</label>
            <input name="enrolledOn" type="date" required defaultValue={today}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Enroll
          </button>
        </form>
      </section>

      {/* Enrolled students */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Students ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">No students enrolled yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Number</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td className="px-4 py-3">
                      <Link href={`/education/bc/students/${e.studentId}`} className="text-blue-600 hover:underline">
                        {e.firstName} {e.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.studentNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{e.status}</td>
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
