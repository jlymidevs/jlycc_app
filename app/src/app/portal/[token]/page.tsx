export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { member, memberRole, role, pastoralCareAssignment, regularMemberApplication } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { event, eventRegistration } from "@/schema/events";
import { eq, and, isNull, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { decodePortalToken } from "@/lib/portal-token";
import { submitApplicationFromPortal } from "@/actions/portal";

export default async function PortalPage({ params }: { params: { token: string } }) {
  const memberId = decodePortalToken(params.token);
  if (!memberId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
        <p className="text-gray-500">This portal link is invalid or has expired.</p>
      </div>
    );
  }

  const [memberRow] = await db.select({
    memberId: member.memberId,
    personId: member.personId,
    memberCode: member.memberCode,
    status: member.status,
    currentStage: member.currentStage,
    firstName: person.firstName,
    lastName: person.lastName,
    branchName: branch.name,
  }).from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(branch, eq(member.branchId, branch.branchId))
    .where(eq(member.memberId, memberId))
    .limit(1);

  if (!memberRow) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Member Not Found</h1>
        <p className="text-gray-500">No member record was found for this link.</p>
      </div>
    );
  }

  const personId = memberRow.personId;

  const roles = await db.select({
    roleName: role.name,
    assignedAt: memberRole.assignedAt,
  }).from(memberRole)
    .innerJoin(role, eq(memberRole.roleId, role.roleId))
    .where(and(eq(memberRole.memberId, memberId), isNull(memberRole.endedAt)));

  const carerMember = alias(member, "carer_member");
  const carerPerson = alias(person, "carer_person");

  const [pcm] = await db.select({
    carerFirstName: carerPerson.firstName,
    carerLastName: carerPerson.lastName,
    assignedAt: pastoralCareAssignment.assignedAt,
  }).from(pastoralCareAssignment)
    .innerJoin(carerMember, eq(pastoralCareAssignment.carerMemberId, carerMember.memberId))
    .innerJoin(carerPerson, eq(carerMember.personId, carerPerson.personId))
    .where(and(
      eq(pastoralCareAssignment.assignedMemberId, memberId),
      eq(pastoralCareAssignment.status, "ACTIVE")
    ))
    .limit(1);

  const [application] = await db.select({
    status: regularMemberApplication.status,
    submittedAt: regularMemberApplication.submittedAt,
  }).from(regularMemberApplication)
    .where(eq(regularMemberApplication.memberId, memberId))
    .orderBy(desc(regularMemberApplication.submittedAt))
    .limit(1);

  const registrations = await db.select({
    eventName: event.name,
    startsAt: event.startsAt,
    status: eventRegistration.status,
  }).from(eventRegistration)
    .innerJoin(event, eq(eventRegistration.eventId, event.eventId))
    .where(eq(eventRegistration.personId, personId))
    .orderBy(desc(eventRegistration.registeredAt))
    .limit(10);

  const canApply = memberRow.status === "ACTIVE" &&
    (!application || (application.status !== "PENDING" && application.status !== "APPROVED"));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {memberRow.firstName} {memberRow.lastName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Member Portal</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Membership</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Member Code</dt>
          <dd className="text-gray-900">{memberRow.memberCode}</dd>
          <dt className="text-gray-500">Status</dt>
          <dd>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              memberRow.status === "ACTIVE" ? "bg-green-50 text-green-700"
              : memberRow.status === "INACTIVE" ? "bg-gray-100 text-gray-600"
              : "bg-yellow-50 text-yellow-700"
            }`}>
              {memberRow.status}
            </span>
          </dd>
          <dt className="text-gray-500">Branch</dt>
          <dd className="text-gray-900">{memberRow.branchName}</dd>
          {memberRow.currentStage && (
            <>
              <dt className="text-gray-500">Stage</dt>
              <dd className="text-gray-900">{memberRow.currentStage}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
        {roles.length === 0 ? (
          <p className="text-sm text-gray-500">No roles assigned.</p>
        ) : (
          <ul className="space-y-1">
            {roles.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{r.roleName}</span>
                <span className="text-gray-400">
                  Since {new Date(r.assignedAt).toLocaleDateString("en-PH")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Pastoral Care</h2>
        {!pcm ? (
          <p className="text-sm text-gray-500">No PCM assigned.</p>
        ) : (
          <p className="text-sm text-gray-900">
            {pcm.carerFirstName} {pcm.carerLastName}
            <span className="text-gray-400 ml-2">
              · since {new Date(pcm.assignedAt).toLocaleDateString("en-PH")}
            </span>
          </p>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Regular Member Application</h2>
        {application ? (
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              application.status === "APPROVED" ? "bg-green-50 text-green-700"
              : application.status === "PENDING" ? "bg-yellow-50 text-yellow-700"
              : application.status === "REJECTED" ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-600"
            }`}>
              {application.status}
            </span>
            <span className="text-sm text-gray-500">
              Submitted {new Date(application.submittedAt).toLocaleDateString("en-PH")}
            </span>
          </div>
        ) : canApply ? (
          <form action={async () => { "use server"; await submitApplicationFromPortal(memberId); }}>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply for Regular Membership
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Not eligible to apply at this time.</p>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Recent Event Registrations</h2>
        {registrations.length === 0 ? (
          <p className="text-sm text-gray-500">No event registrations yet.</p>
        ) : (
          <ul className="space-y-2">
            {registrations.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{r.eventName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">
                    {new Date(r.startsAt).toLocaleDateString("en-PH")}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "CONFIRMED" ? "bg-green-50 text-green-700"
                    : r.status === "WAITLISTED" ? "bg-yellow-50 text-yellow-700"
                    : r.status === "CANCELLED" ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
