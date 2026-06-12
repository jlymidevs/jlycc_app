// app/src/app/(admin)/members/trash/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { eq, isNotNull } from "drizzle-orm";
import { TrashActions } from "./trash-actions";

export default async function MembersTrashPage() {
  const rows = await db
    .select({
      memberId: member.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      branchName: branch.name,
      deletedAt: member.deletedAt,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(branch, eq(member.branchId, branch.branchId))
    .where(isNotNull(member.deletedAt))
    .orderBy(member.deletedAt);

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/members"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Members
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
        <p className="mt-1 text-sm text-gray-500">
          Members are permanently deleted 7 days after being trashed.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Trash is empty.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-3 pr-4 font-medium">Name</th>
              <th className="py-3 pr-4 font-medium">Code</th>
              <th className="py-3 pr-4 font-medium">Stage</th>
              <th className="py-3 pr-4 font-medium">Branch</th>
              <th className="py-3 pr-4 font-medium">Trashed</th>
              <th className="py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const deletedMs = now.getTime() - m.deletedAt!.getTime();
              const deletedDays = deletedMs / (1000 * 60 * 60 * 24);
              const canPermanentDelete = deletedDays >= 7;
              const daysLeft = Math.max(0, Math.ceil(7 - deletedDays));

              return (
                <tr key={m.memberId} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-700 font-medium">
                    {m.lastName}, {m.firstName}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">{m.memberCode}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {m.currentStage}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">{m.branchName}</td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">
                    {m.deletedAt!.toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {!canPermanentDelete && (
                      <span className="ml-1 text-gray-400">
                        ({daysLeft}d left)
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <TrashActions
                      memberId={m.memberId}
                      canPermanentDelete={canPermanentDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
