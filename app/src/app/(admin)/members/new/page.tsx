// app/src/app/(admin)/members/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { lifecycleStage } from "@/schema/membership";
import { MemberForm } from "@/components/members/member-form";
import { createMember } from "@/actions/members";
import { eq } from "drizzle-orm";

export default async function NewMemberPage() {
  const [branches, stages] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/members"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Members
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Add member</h1>
      </div>

      <form action={createMember} className="space-y-6">
        <MemberForm branches={branches} stages={stages} />
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create member
          </button>
          <Link
            href="/members"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
