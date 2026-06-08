// app/src/app/(admin)/education/bc/students/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bcStudent, bcCohort, bcProgram, bcEnrollment, bcCourseOffering, bcCourse, bcSemester } from "@/schema/education";
import { person } from "@/schema/core";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcStudentDetailPage({ params }: { params: { id: string } }) {
  const studentId = Number(params.id);

  const [student] = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcStudent.status,
      enrolledOn: bcStudent.enrolledOn,
      graduatedOn: bcStudent.graduatedOn,
      firstName: person.firstName,
      lastName: person.lastName,
      cohortName: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcStudent)
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .innerJoin(bcCohort, eq(bcStudent.cohortId, bcCohort.cohortId))
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcStudent.studentId, studentId as any));

  if (!student) notFound();

  const enrollments = await db
    .select({
      enrollmentId: bcEnrollment.enrollmentId,
      enrolledOn: bcEnrollment.enrolledOn,
      status: bcEnrollment.status,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
    })
    .from(bcEnrollment)
    .innerJoin(bcCourseOffering, eq(bcEnrollment.offeringId, bcCourseOffering.offeringId))
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.studentId, studentId as any))
    .orderBy(bcEnrollment.enrollmentId);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {student.studentNumber} · {student.programName} — {student.cohortName} · {student.status}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Course enrollments ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">No course enrollments yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Course</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Semester</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td className="px-4 py-3 text-gray-900">{e.courseCode} — {e.courseTitle}</td>
                    <td className="px-4 py-3 text-gray-600">{e.semesterName}</td>
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
