// app/src/app/(admin)/members/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { member, memberRole, role } from "@/schema/membership";
import { person, contactInfo, branch } from "@/schema/core";
import { eq, and, isNull } from "drizzle-orm";

export default async function MemberDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const memberId = Number(params.id);
  if (isNaN(memberId)) notFound();

  const [row] = await db
    .select({
      memberId: member.memberId,
      memberCode: member.memberCode,
      status: member.status,
      currentStage: member.currentStage,
      joinedAt: member.joinedAt,
      regularMemberSince: member.regularMemberSince,
      personId: person.personId,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      suffix: person.suffix,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
      maritalStatus: person.maritalStatus,
      branchName: branch.name,
      branchCode: branch.code,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(branch, eq(member.branchId, branch.branchId))
    .where(and(eq(member.memberId, memberId), isNull(member.deletedAt)))
    .limit(1);

  if (!row) notFound();

  const contacts = await db
    .select()
    .from(contactInfo)
    .where(eq(contactInfo.personId, row.personId));

  const roles = await db
    .select({ code: role.code, name: role.name })
    .from(memberRole)
    .innerJoin(role, eq(memberRole.roleId, role.roleId))
    .where(and(eq(memberRole.memberId, memberId), isNull(memberRole.endedAt)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/members"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Members
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {row.lastName}, {row.firstName}{" "}
            {row.suffix && <span className="text-gray-500">{row.suffix}</span>}
          </h1>
          <p className="text-sm text-gray-500">{row.memberCode}</p>
        </div>
        <Link
          href={`/admin/members/${memberId}/edit`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </Link>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Personal
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Date of birth</dt>
            <dd className="font-medium">{row.dateOfBirth ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Gender</dt>
            <dd className="font-medium">{row.gender ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Marital status</dt>
            <dd className="font-medium">{row.maritalStatus ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Membership
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Branch</dt>
            <dd className="font-medium">{row.branchName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Stage</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {row.currentStage}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium">{row.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Joined</dt>
            <dd className="font-medium">
              {row.joinedAt.toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </section>

      {contacts.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Contact
          </h2>
          <dl className="space-y-2 text-sm">
            {contacts.map((c) => (
              <div key={c.contactId} className="flex gap-4">
                <dt className="text-gray-500 w-20">{c.type}</dt>
                <dd className="font-medium">{c.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {roles.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Roles
          </h2>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r.code}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {r.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
