// app/src/app/(admin)/members/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { MemberSearch } from "@/components/members/member-search";
import { eq, ilike, or, and, isNull, sql } from "drizzle-orm";
import { Suspense } from "react";

const PAGE_SIZE = 25;

async function MemberTable({
  q,
  page,
}: {
  q: string;
  page: number;
}) {
  const offset = (page - 1) * PAGE_SIZE;

  const baseCondition = isNull(member.deletedAt);
  const searchCondition = q
    ? or(
        ilike(person.firstName, `%${q}%`),
        ilike(person.lastName, `%${q}%`),
        ilike(
          sql`${person.firstName} || ' ' || ${person.lastName}`,
          `%${q}%`
        )
      )
    : undefined;

  const condition = searchCondition
    ? and(baseCondition, searchCondition)
    : baseCondition;

  const rows = await db
    .select({
      memberId: member.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      status: member.status,
      branchName: branch.name,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(branch, eq(member.branchId, branch.branchId))
    .where(condition)
    .orderBy(person.lastName, person.firstName)
    .limit(PAGE_SIZE)
    .offset(offset);

  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-sm mt-4">No members found.</p>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-3 pr-4 font-medium">Name</th>
          <th className="py-3 pr-4 font-medium">Code</th>
          <th className="py-3 pr-4 font-medium">Stage</th>
          <th className="py-3 pr-4 font-medium">Branch</th>
          <th className="py-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr
            key={m.memberId}
            className="border-b border-gray-100 hover:bg-gray-50"
          >
            <td className="py-3 pr-4">
              <Link
                href={`/admin/members/${m.memberId}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {m.lastName}, {m.firstName}
              </Link>
            </td>
            <td className="py-3 pr-4 text-gray-600">{m.memberCode}</td>
            <td className="py-3 pr-4">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {m.currentStage}
              </span>
            </td>
            <td className="py-3 pr-4 text-gray-600">{m.branchName}</td>
            <td className="py-3 text-gray-600">{m.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <Link
          href="/admin/members/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add member
        </Link>
      </div>

      <Suspense fallback={null}>
        <MemberSearch />
      </Suspense>

      <Suspense fallback={<p className="text-gray-500 text-sm">Loading…</p>}>
        <MemberTable q={q} page={page} />
      </Suspense>

      <div className="flex gap-2 text-sm">
        {page > 1 && (
          <Link
            href={`/admin/members?q=${q}&page=${page - 1}`}
            className="text-blue-600 hover:underline"
          >
            ← Previous
          </Link>
        )}
        <Link
          href={`/admin/members?q=${q}&page=${page + 1}`}
          className="text-blue-600 hover:underline"
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
