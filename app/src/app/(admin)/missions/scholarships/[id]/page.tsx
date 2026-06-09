// app/src/app/(admin)/missions/scholarships/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { scholarProgram, scholarshipAward } from "@/schema/missions";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { eq, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ScholarProgramDetailPage({ params }: { params: { id: string } }) {
  const programId = Number(params.id);

  const [program] = await db
    .select()
    .from(scholarProgram)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarProgram.programId, programId as any));

  if (!program) notFound();

  const [{ awardCount }] = await db
    .select({ awardCount: count() })
    .from(scholarshipAward)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarshipAward.programId, programId as any));

  const awards = await db
    .select({
      awardId: scholarshipAward.awardId,
      term: scholarshipAward.term,
      amount: scholarshipAward.amount,
      schoolName: scholarshipAward.schoolName,
      status: scholarshipAward.status,
      awardedAt: scholarshipAward.awardedAt,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(scholarshipAward)
    .innerJoin(member, eq(scholarshipAward.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(scholarshipAward.programId, programId as any))
    .orderBy(scholarshipAward.awardedAt);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/missions/scholarships" className="text-sm text-gray-500 hover:text-gray-900">
            ← Scholarship Programs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{program.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {program.status}
            {program.startsOn ? ` · ${program.startsOn}` : ""}
            {program.endsOn ? ` – ${program.endsOn}` : ""}
          </p>
          {program.description && (
            <p className="text-sm text-gray-600 mt-2">{program.description}</p>
          )}
        </div>
        <Link
          href={`/missions/scholarships/${programId}/awards/new`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add award
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{awardCount}</p>
          <p className="text-xs text-gray-500">Awards</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Awards ({awards.length})</h2>
        {awards.length === 0 ? (
          <p className="text-sm text-gray-500">No awards yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Awardee</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">School</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Term</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {awards.map((a) => (
                  <tr key={a.awardId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.firstName} {a.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.schoolName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.term ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.amount ? `₱${a.amount}` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{a.status}</td>
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
