// app/src/app/(admin)/members/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { MemberSearch } from "@/components/members/member-search";
import { MemberTrashButton } from "@/components/members/member-trash-button";
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
          <th className="py-3 pr-4 font-medium">Status</th>
          <th className="py-3 font-medium w-8"></th>
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
                href={`/members/${m.memberId}`}
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
            <td className="py-3 pr-4 text-gray-600">{m.status}</td>
            <td className="py-3 text-right">
              <MemberTrashButton memberId={m.memberId} />
            </td>
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <Link
            href="/members/trash"
            title="View trash"
            className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
        <Link
          href="/members/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add member
        </Link>
      </div>

      <MemberSearch defaultValue={q} />

      <Suspense fallback={<p className="text-gray-500 text-sm">Loading…</p>}>
        <MemberTable q={q} page={page} />
      </Suspense>

      <div className="flex gap-2 text-sm">
        {page > 1 && (
          <Link
            href={`/members?q=${q}&page=${page - 1}`}
            className="text-blue-600 hover:underline"
          >
            ← Previous
          </Link>
        )}
        <Link
          href={`/members?q=${q}&page=${page + 1}`}
          className="text-blue-600 hover:underline"
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
