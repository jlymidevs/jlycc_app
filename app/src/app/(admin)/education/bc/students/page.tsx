// app/src/app/(admin)/education/bc/students/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcStudent, bcCohort, bcProgram } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcStudentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type StudentStatus = "ACTIVE" | "ON_LEAVE" | "GRADUATED" | "WITHDRAWN" | "DISMISSED";
  const statusValues: StudentStatus[] =
    statusFilter === "all"
      ? ["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"]
      : statusFilter === "graduated"
      ? ["GRADUATED"]
      : ["ACTIVE", "ON_LEAVE"];

  const students = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcStudent.status,
      enrolledOn: bcStudent.enrolledOn,
      firstName: person.firstName,
      lastName: person.lastName,
      cohortName: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcStudent)
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .innerJoin(bcCohort, eq(bcStudent.cohortId, bcCohort.cohortId))
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    .where(inArray(bcStudent.status, statusValues))
    .orderBy(desc(bcStudent.studentId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">BC Students</h1>
        <Link
          href="/education/bc/students/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register student
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "graduated", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/education/bc/students?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
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
                <th className="px-4 py-2 text-left font-medium text-gray-700">Number</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Program / Cohort</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/education/bc/students/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.studentNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{s.programName} — {s.cohortName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <Link href="/education/bc/offerings" className="text-sm text-blue-600 hover:underline">
          View course offerings →
        </Link>
        <Link href="/education/isu/students" className="text-sm text-blue-600 hover:underline">
          Switch to ISU →
        </Link>
      </div>
    </div>
  );
}
