// app/src/app/(admin)/members/applications/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { regularMemberApplication, member } from "@/schema/membership";
import { person } from "@/schema/core";
import { eq } from "drizzle-orm";
import { reviewApplication } from "@/actions/membership-extensions";

async function approveAction(formData: FormData) {
  "use server";
  const applicationId = Number(formData.get("applicationId"));
  const decisionNotes = (formData.get("decisionNotes") as string) || undefined;
  await reviewApplication(applicationId, "APPROVED", decisionNotes);
}

async function rejectAction(formData: FormData) {
  "use server";
  const applicationId = Number(formData.get("applicationId"));
  const decisionNotes = (formData.get("decisionNotes") as string) || undefined;
  await reviewApplication(applicationId, "REJECTED", decisionNotes);
}

async function withdrawAction(formData: FormData) {
  "use server";
  const applicationId = Number(formData.get("applicationId"));
  await reviewApplication(applicationId, "WITHDRAWN");
}

export default async function ApplicationsPage() {
  const rows = await db
    .select({
      applicationId: regularMemberApplication.applicationId,
      submittedAt: regularMemberApplication.submittedAt,
      memberId: member.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(regularMemberApplication)
    .innerJoin(member, eq(regularMemberApplication.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(regularMemberApplication.status, "PENDING"))
    .orderBy(regularMemberApplication.submittedAt);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pending Applications</h1>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm mt-4">No pending applications.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-3 pr-4 font-medium">Member</th>
              <th className="py-3 pr-4 font-medium">Code</th>
              <th className="py-3 pr-4 font-medium">Submitted</th>
              <th className="py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.applicationId}
                className="border-b border-gray-100 hover:bg-gray-50 align-top"
              >
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {row.lastName}, {row.firstName}
                </td>
                <td className="py-3 pr-4 text-gray-600">{row.memberCode}</td>
                <td className="py-3 pr-4 text-gray-600">
                  {new Date(row.submittedAt).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-4">
                    {/* Approve */}
                    <form action={approveAction} className="flex flex-col gap-1">
                      <input
                        type="hidden"
                        name="applicationId"
                        value={row.applicationId}
                      />
                      <textarea
                        name="decisionNotes"
                        placeholder="Notes (optional)"
                        rows={2}
                        className="text-xs border border-gray-200 rounded px-2 py-1 w-40 resize-none"
                      />
                      <button
                        type="submit"
                        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>

                    {/* Reject */}
                    <form action={rejectAction} className="flex flex-col gap-1">
                      <input
                        type="hidden"
                        name="applicationId"
                        value={row.applicationId}
                      />
                      <textarea
                        name="decisionNotes"
                        placeholder="Notes (optional)"
                        rows={2}
                        className="text-xs border border-gray-200 rounded px-2 py-1 w-40 resize-none"
                      />
                      <button
                        type="submit"
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </form>

                    {/* Withdraw */}
                    <form action={withdrawAction} className="flex flex-col justify-end">
                      <input
                        type="hidden"
                        name="applicationId"
                        value={row.applicationId}
                      />
                      <button
                        type="submit"
                        className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                      >
                        Withdraw
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
