// app/src/app/welcome/page.tsx
// Post-Google-signin profile completion. Existing members (any ministry
// membership or join request) are bounced straight to /me.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import { person, contactInfo } from "@/schema/core";
import { joinRequest, ministryMembership } from "@/schema/ministries";
import { requireRole } from "@/lib/authz-server";
import { completeProfile, listActiveHeads } from "@/actions/account";
import { and, eq, isNull } from "drizzle-orm";

export default async function WelcomePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;
  const role = session.user!.role;

  // Staff don't need profile completion — send them to their landing page
  // (same destinations as the credentials login).
  if (role === "ADMIN" || role === "SUPER_ADMIN") redirect("/members");
  if (role === "MINISTRY_HEAD") redirect("/ministry");

  const [me] = await db
    .select({
      memberId: member.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.email, email))
    .limit(1);

  // Already settled in? Skip the welcome step.
  if (me) {
    const [membership] = await db
      .select({ id: ministryMembership.membershipId })
      .from(ministryMembership)
      .where(
        and(
          eq(ministryMembership.memberId, me.memberId),
          isNull(ministryMembership.endedAt)
        )
      )
      .limit(1);
    const [request] = await db
      .select({ id: joinRequest.requestId })
      .from(joinRequest)
      .where(eq(joinRequest.memberId, me.memberId))
      .limit(1);
    if (membership || request) redirect("/me");
  }

  const [mobileRow] = me
    ? await db
        .select({ value: contactInfo.value })
        .from(contactInfo)
        .innerJoin(users, eq(contactInfo.personId, users.personId))
        .where(and(eq(users.email, email), eq(contactInfo.type, "MOBILE")))
        .limit(1)
    : [];

  const heads = await listActiveHeads();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(31,138,139,0.25) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jlycc-logo.png" alt="JLYCC" width={64} height={64} className="mx-auto" style={{ objectFit: "contain" }} />
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Welcome to JLYCC!
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Tell us a bit more about yourself to finish setting up.
            </p>
          </div>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form action={completeProfile as any} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  First name <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
                </label>
                <input
                  name="firstName"
                  type="text"
                  required
                  defaultValue={me?.firstName ?? ""}
                  className="input-dark"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Last name <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
                </label>
                <input
                  name="lastName"
                  type="text"
                  required
                  defaultValue={me?.lastName ?? ""}
                  className="input-dark"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Mobile number
              </label>
              <input
                name="mobile"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                defaultValue={mobileRow?.value ?? ""}
                className="input-dark"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Birthday
                </label>
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={me?.dateOfBirth ?? ""}
                  className="input-dark"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Gender
                </label>
                <select name="gender" defaultValue={me?.gender ?? ""} className="input-dark">
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            {heads.length > 0 && (
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Your ministry head
                </label>
                <select name="chapterId" className="input-dark" defaultValue="">
                  <option value="">Choose later from your profile</option>
                  {heads.map((h) => (
                    <option key={h.chapterId} value={h.chapterId}>
                      {h.headFirstName} {h.headLastName} — {h.ministryName}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Your head will approve your request (this becomes your 1st-priority
                  ministry).
                </p>
              </div>
            )}

            <button type="submit" className="btn-accent w-full mt-1">
              Save and continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
