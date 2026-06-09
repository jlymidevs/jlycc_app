// app/src/app/(admin)/members/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  member,
  memberRole,
  role,
  pastoralCareAssignment,
  regularMemberApplication,
} from "@/schema/membership";
import { person, contactInfo, branch } from "@/schema/core";
import { eq, and, isNull, desc } from "drizzle-orm";
import { QRCodeSVG } from "qrcode.react";
import {
  assignRole,
  endRole,
  assignPcm,
  endPcm,
  submitApplication,
} from "@/actions/membership-extensions";

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { pcmErr?: string };
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

  // Roles section data
  const activeRoles = await db
    .select({
      memberRoleId: memberRole.memberRoleId,
      assignedAt: memberRole.assignedAt,
      roleName: role.name,
    })
    .from(memberRole)
    .innerJoin(role, eq(memberRole.roleId, role.roleId))
    .where(and(eq(memberRole.memberId, memberId), isNull(memberRole.endedAt)));

  const allRoles = await db.select().from(role);

  // Pastoral Care section data
  const activePcm = await db
    .select({
      assignmentId: pastoralCareAssignment.assignmentId,
      assignedAt: pastoralCareAssignment.assignedAt,
      firstName: person.firstName,
      lastName: person.lastName,
      memberCode: member.memberCode,
    })
    .from(pastoralCareAssignment)
    .innerJoin(member, eq(pastoralCareAssignment.carerMemberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        eq(pastoralCareAssignment.assignedMemberId, memberId),
        isNull(pastoralCareAssignment.endedAt)
      )
    )
    .limit(1);

  // Regular Member Application
  const [latestApp] = await db
    .select()
    .from(regularMemberApplication)
    .where(eq(regularMemberApplication.memberId, memberId))
    .orderBy(desc(regularMemberApplication.createdAt))
    .limit(1);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/members"
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
          href={`/members/${memberId}/edit`}
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

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Attendance QR
        </h2>
        <p className="text-xs text-gray-500">
          Show this code to an usher for quick check-in at events.
        </p>
        <QRCodeSVG value={String(row.personId)} size={160} />
      </section>

      {/* Roles Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Roles
        </h2>
        {activeRoles.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {activeRoles.map((r) => (
              <li key={r.memberRoleId} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{r.roleName}</span>
                  <span className="text-gray-500 ml-2">
                    since {new Date(r.assignedAt).toLocaleDateString()}
                  </span>
                </span>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const id = Number(formData.get("memberRoleId"));
                    const ended = String(formData.get("endedAt"));
                    await endRole(id, ended);
                  }}
                >
                  <input type="hidden" name="memberRoleId" value={r.memberRoleId} />
                  <input type="hidden" name="endedAt" value={today} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    End
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No active roles.</p>
        )}
        <form
          className="space-y-3 pt-2 border-t border-gray-100"
          action={async (formData: FormData) => {
            "use server";
            await assignRole({
              memberId,
              roleId: Number(formData.get("roleId")),
              assignedAt: String(formData.get("assignedAt")),
              notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500" htmlFor="roleId">Role</label>
            <select
              name="roleId"
              id="roleId"
              required
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {allRoles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500" htmlFor="roleAssignedAt">Assigned at</label>
            <input
              type="date"
              name="assignedAt"
              id="roleAssignedAt"
              defaultValue={today}
              required
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500" htmlFor="roleNotes">Notes (optional)</label>
            <textarea
              name="notes"
              id="roleNotes"
              rows={2}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Assign
          </button>
        </form>
      </section>

      {/* Pastoral Care Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Pastoral Care
        </h2>
        {searchParams.pcmErr && (
          <p className="text-sm text-red-600">{searchParams.pcmErr}</p>
        )}
        {activePcm.length > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span>
              Carer:{" "}
              <span className="font-medium">
                {activePcm[0].firstName} {activePcm[0].lastName}
              </span>{" "}
              <span className="text-gray-500">({activePcm[0].memberCode})</span>
              , since {new Date(activePcm[0].assignedAt).toLocaleDateString()}
            </span>
            <form
              action={async (formData: FormData) => {
                "use server";
                const id = Number(formData.get("assignmentId"));
                const ended = String(formData.get("endedAt"));
                await endPcm(id, ended);
              }}
            >
              <input type="hidden" name="assignmentId" value={activePcm[0].assignmentId} />
              <input type="hidden" name="endedAt" value={today} />
              <button type="submit" className="text-xs text-red-600 hover:underline">
                End
              </button>
            </form>
          </div>
        ) : (
          <form
            className="space-y-3"
            action={async (formData: FormData) => {
              "use server";
              await assignPcm({
                carerMemberId: Number(formData.get("carerMemberId")),
                assignedMemberId: memberId,
                assignedAt: String(formData.get("assignedAt")),
                notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
              });
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500" htmlFor="carerMemberId">Carer Member ID</label>
              <input
                type="number"
                name="carerMemberId"
                id="carerMemberId"
                required
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500" htmlFor="pcmAssignedAt">Assigned at</label>
              <input
                type="date"
                name="assignedAt"
                id="pcmAssignedAt"
                defaultValue={today}
                required
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500" htmlFor="pcmNotes">Notes (optional)</label>
              <textarea
                name="notes"
                id="pcmNotes"
                rows={2}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Assign
            </button>
          </form>
        )}
      </section>

      {/* Regular Member Application Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Regular Member Application
        </h2>
        {latestApp ? (
          <div className="text-sm space-y-1">
            {latestApp.status === "APPROVED" && (
              <div>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Approved
                </span>
                {latestApp.reviewedAt && (
                  <span className="text-gray-500 ml-2">
                    on {new Date(latestApp.reviewedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
            {latestApp.status === "PENDING" && (
              <div>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending review
                </span>
                <span className="text-gray-500 ml-2">
                  submitted {new Date(latestApp.submittedAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {(latestApp.status === "REJECTED" || latestApp.status === "WITHDRAWN") && (
              <div>
                <span className="font-medium">{latestApp.status}</span>
                {latestApp.decisionNotes && (
                  <p className="text-gray-500 mt-1">{latestApp.decisionNotes}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await submitApplication(memberId);
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Submit application
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
