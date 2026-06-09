// app/src/app/(admin)/missions/scholarships/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { scholarProgram } from "@/schema/missions";
import { desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type ProgramStatus = "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  const statusValues: ProgramStatus[] =
    statusFilter === "all"
      ? ["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]
      : statusFilter === "completed"
      ? ["COMPLETED", "CANCELLED"]
      : ["PLANNING", "ACTIVE"];

  const programs = await db
    .select({
      programId: scholarProgram.programId,
      name: scholarProgram.name,
      status: scholarProgram.status,
      startsOn: scholarProgram.startsOn,
      endsOn: scholarProgram.endsOn,
      description: scholarProgram.description,
    })
    .from(scholarProgram)
    .where(inArray(scholarProgram.status, statusValues))
    .orderBy(desc(scholarProgram.programId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Scholarship Programs</h1>
        <Link
          href="/missions/scholarships/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New program
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "completed", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/missions/scholarships?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-gray-500">No scholarship programs found.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <Link
              key={p.programId}
              href={`/missions/scholarships/${p.programId}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.description && (
                    <p className="text-sm text-gray-500">{p.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-gray-400">
                    {p.startsOn && <span>Starts {p.startsOn}</span>}
                    {p.endsOn && <span>Ends {p.endsOn}</span>}
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase">{p.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
