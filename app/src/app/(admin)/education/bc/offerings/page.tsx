// app/src/app/(admin)/education/bc/offerings/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcCourseOffering, bcCourse, bcSemester } from "@/schema/education";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcOfferingsPage() {
  const offerings = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      venue: bcCourseOffering.venue,
      maxSeats: bcCourseOffering.maxSeats,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
      semesterStatus: bcSemester.status,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    .orderBy(desc(bcCourseOffering.offeringId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">BC Course Offerings</h1>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
      </div>

      {offerings.length === 0 ? (
        <p className="text-sm text-gray-500">No course offerings found. Add via DB seed or admin.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Course</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Semester</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Venue</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offerings.map((o) => (
                <tr key={o.offeringId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{o.courseCode} — {o.courseTitle}</td>
                  <td className="px-4 py-3 text-gray-600">{o.semesterName} <span className="text-xs text-gray-400 uppercase">({o.semesterStatus})</span></td>
                  <td className="px-4 py-3 text-gray-600">{o.venue ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/education/bc/offerings/${o.offeringId}`} className="text-blue-600 hover:underline text-xs">
                      Detail →
                    </Link>
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
