// app/src/app/me/profile/page.tsx
// Self-service profile editor. Stage is read-only — only a Ministry Head
// can promote (see appointment-hierarchy spec).
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import { person, contactInfo, address, personAddress } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { updateMyProfile } from "@/actions/account";
import { PH_PROVINCES } from "@/lib/ph-provinces";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

const COUNTRIES: [string, string][] = [
  ["PH", "Philippines"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["AE", "United Arab Emirates"],
  ["SA", "Saudi Arabia"],
  ["SG", "Singapore"],
  ["HK", "Hong Kong"],
  ["JP", "Japan"],
  ["AU", "Australia"],
  ["GB", "United Kingdom"],
  ["XX", "Other"],
];

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: { saved?: string; err?: string };
}) {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({
      personId: users.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
      stageName: lifecycleStage.name,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(lifecycleStage, eq(member.currentStage, lifecycleStage.stageCode))
    .where(eq(users.email, email))
    .limit(1);
  if (!me || me.personId == null) redirect("/welcome");

  const [mobileRow] = await db
    .select({ value: contactInfo.value })
    .from(contactInfo)
    .where(and(eq(contactInfo.personId, me.personId), eq(contactInfo.type, "MOBILE")))
    .limit(1);

  const [home] = await db
    .select({ city: address.city, province: address.province, countryCode: address.countryCode })
    .from(personAddress)
    .innerJoin(address, eq(personAddress.addressId, address.addressId))
    .where(
      and(
        eq(personAddress.personId, me.personId),
        eq(personAddress.type, "HOME"),
        isNull(personAddress.validTo)
      )
    )
    .limit(1);

  const country = home?.countryCode ?? "PH";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-2 py-6 md:px-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My Profile
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Keep your details up to date
        </p>
      </div>

      {searchParams.saved && (
        <p
          className="rounded-md px-4 py-2 text-sm"
          style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
        >
          Profile saved.
        </p>
      )}
      {searchParams.err && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Could not save — please check your entries.
        </p>
      )}

      <div className="card space-y-4 p-6">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>Email</span>
          <span style={{ color: "var(--text-primary)" }}>{email}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>Membership stage</span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
          >
            {me.stageName}
          </span>
        </div>
      </div>

      <form action={updateMyProfile} className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              First name *
            </label>
            <input name="firstName" type="text" required defaultValue={me.firstName} className="input-dark" />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Last name *
            </label>
            <input name="lastName" type="text" required defaultValue={me.lastName} className="input-dark" />
          </div>
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-medium"
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
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Birthday
            </label>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={me.dateOfBirth ?? ""}
              className="input-dark"
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Gender
            </label>
            <select
              name="gender"
              defaultValue={me.gender === "UNDISCLOSED" ? "" : me.gender ?? ""}
              className="input-dark"
            >
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Country
            </label>
            <select name="countryCode" defaultValue={country} className="input-dark">
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Province / City
            </label>
            {country === "PH" ? (
              <select name="province" defaultValue={home?.province ?? ""} className="input-dark">
                <option value="">Choose…</option>
                {PH_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="city"
                type="text"
                placeholder="City / province"
                defaultValue={home?.city ?? home?.province ?? ""}
                className="input-dark"
              />
            )}
          </div>
        </div>

        <button type="submit" className="btn-accent mt-1 w-full">
          Save profile
        </button>
      </form>
    </div>
  );
}
