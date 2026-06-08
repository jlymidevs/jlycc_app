// app/src/app/(admin)/members/[id]/edit/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { member, lifecycleStage } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { MemberForm } from "@/components/members/member-form";
import { updateMember } from "@/actions/members";
import { eq, and, isNull } from "drizzle-orm";

export default async function EditMemberPage({
  params,
}: {
  params: { id: string };
}) {
  const memberId = Number(params.id);
  if (isNaN(memberId)) notFound();

  const [[row], branches, stages] = await Promise.all([
    db
      .select({
        memberId: member.memberId,
        currentStage: member.currentStage,
        joinedAt: member.joinedAt,
        branchId: member.branchId,
        firstName: person.firstName,
        middleName: person.middleName,
        lastName: person.lastName,
        gender: person.gender,
        maritalStatus: person.maritalStatus,
      })
      .from(member)
      .innerJoin(person, eq(member.personId, person.personId))
      .where(and(eq(member.memberId, memberId), isNull(member.deletedAt)))
      .limit(1),
    db
      .select({ branchId: branch.branchId, name: branch.name })
      .from(branch)
      .where(eq(branch.status, "ACTIVE"))
      .orderBy(branch.name),
    db
      .select({
        stageCode: lifecycleStage.stageCode,
        name: lifecycleStage.name,
        orderIndex: lifecycleStage.orderIndex,
      })
      .from(lifecycleStage)
      .where(eq(lifecycleStage.isActive, true))
      .orderBy(lifecycleStage.orderIndex),
  ]);

  if (!row) notFound();

  const action = updateMember.bind(null, memberId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/members/${memberId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← {row.lastName}, {row.firstName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit member</h1>
      </div>

      <form action={(fd) => void action(fd)} className="space-y-6">
        <MemberForm
          branches={branches}
          stages={stages}
          defaultValues={{
            firstName: row.firstName,
            middleName: row.middleName ?? undefined,
            lastName: row.lastName,
            gender: row.gender ?? undefined,
            branchId: row.branchId,
            currentStage: row.currentStage,
            joinedAt: row.joinedAt.toISOString().split("T")[0],
          }}
        />
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save changes
          </button>
          <Link
            href={`/admin/members/${memberId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
