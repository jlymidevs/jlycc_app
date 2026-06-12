# One-Time Welcome, My Profile & Appointment Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Welcome profile completion shows exactly once; members get a self-service `/me/profile` page (incl. country/province) and see their lifecycle stage; a strict appointment chain is added — Admin appoints Network Heads, Network Heads appoint Ministry Heads, Ministry Heads promote chapter members up to Inner Core.

**Architecture:** Two DB migrations (V070 `profile_completed_at` + role-check expansion + nullable `address.line1`; V071 `ministries.network_leader`). New `NETWORK_HEAD` role slots into the existing ordered-ladder authz (`hasRole`). All appointment actions re-validate ownership server-side. UI follows existing server-component + native-form patterns.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, PostgreSQL/Flyway, NextAuth v5, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-12-profile-and-appointment-hierarchy-design.md`

**Branch:** create `feature/profile-appointment-hierarchy` (worktree recommended).

**Conventions for every task:** run commands from `app/` unless stated. Local DB must be up (`cd db && docker compose up -d`). NEVER run E2E or dev verification against the Neon URL — override `DATABASE_URL=postgresql://jly_admin:localdevpassword@localhost:5432/jly` (and `_READER`).

---

## Phase 1 — one-time welcome + My Profile + stage visibility

### Task 1: Migration V070 + Drizzle schema updates

**Files:**
- Create: `db/migrations/V070__profile_completed_network_head_role.sql`
- Modify: `app/src/schema/app.ts` (add `profileCompletedAt`)
- Modify: `app/src/schema/core.ts` (add `address`, `personAddress`, `addressTypeEnum`)

- [ ] **Step 1: Write the migration**

```sql
-- db/migrations/V070__profile_completed_network_head_role.sql
-- One-time welcome flag, city/province-only addresses, NETWORK_HEAD role.

ALTER TABLE app.users ADD COLUMN profile_completed_at TIMESTAMPTZ;
COMMENT ON COLUMN app.users.profile_completed_at IS
  'Set when the member finishes the /welcome step. NULL = show /welcome.';

-- /me/profile saves city/province + country only; line1 becomes optional.
ALTER TABLE core.address ALTER COLUMN line1 DROP NOT NULL;

ALTER TABLE app.users DROP CONSTRAINT users_role_check;
ALTER TABLE app.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','NETWORK_HEAD','MINISTRY_HEAD','MEMBER'));

-- Existing members with a provisioned person already passed the welcome
-- step (or signed up via the credentials form, which collects the same
-- fields) — never show them /welcome again.
UPDATE app.users SET profile_completed_at = now()
  WHERE role = 'MEMBER' AND person_id IS NOT NULL;
```

- [ ] **Step 2: Apply locally and verify**

Run (repo root): `docker run --rm -v "${PWD}\db\migrations:/flyway/sql" -v "${PWD}\db\flyway.conf:/flyway/conf/flyway.conf" --network host flyway/flyway:10 migrate`
Expected: `Successfully applied 1 migration` (V070). If the docker-compose flyway service is preferred: `cd db && docker compose run --rm flyway migrate`.

- [ ] **Step 3: Add `profileCompletedAt` to the users schema**

In `app/src/schema/app.ts`, add after `isActive`:

```ts
  profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
```

- [ ] **Step 4: Add address tables to `app/src/schema/core.ts`**

Append (uses existing imports plus `point` is NOT needed — omit `geom`; Drizzle never writes it):

```ts
export const addressTypeEnum = coreSchema.enum("address_type", [
  "HOME",
  "WORK",
  "MAILING",
]);

export const address = coreSchema.table("address", {
  addressId: bigserial("address_id", { mode: "number" }).primaryKey(),
  line1: text("line1"),
  line2: text("line2"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  countryCode: text("country_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const personAddress = coreSchema.table("person_address", {
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId, { onDelete: "cascade" }),
  addressId: bigint("address_id", { mode: "number" })
    .notNull()
    .references(() => address.addressId),
  type: addressTypeEnum("type").notNull(),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Add `bigserial`, `bigint`, `date` to the `drizzle-orm/pg-core` import in `core.ts` if missing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/V070__profile_completed_network_head_role.sql app/src/schema/app.ts app/src/schema/core.ts
git commit -m "feat(db): profile_completed_at, nullable address line1, NETWORK_HEAD role"
```

### Task 2: NETWORK_HEAD in the authz ladder + middleware

**Files:**
- Modify: `app/src/lib/authz.ts:5` (ROLES array)
- Modify: `app/src/middleware.ts:23-28` (ROLE_RANK) and add `/network-head` guard
- Test: `app/tests/unit/authz.test.ts` (existing file — extend; if the ladder test lives elsewhere, find with `rg "hasRole" tests/unit`)

- [ ] **Step 1: Write the failing test** (append to the existing authz unit test file)

```ts
describe("NETWORK_HEAD ladder position", () => {
  it("sits between MINISTRY_HEAD and ADMIN", () => {
    expect(hasRole("NETWORK_HEAD", "MINISTRY_HEAD")).toBe(true);
    expect(hasRole("NETWORK_HEAD", "ADMIN")).toBe(false);
    expect(hasRole("ADMIN", "NETWORK_HEAD")).toBe(true);
    expect(hasRole("MINISTRY_HEAD", "NETWORK_HEAD")).toBe(false);
    expect(hasRole("MEMBER", "NETWORK_HEAD")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/unit/authz.test.ts` (type error / false results).

- [ ] **Step 3: Update `authz.ts`**

```ts
export const ROLES = ["MEMBER", "MINISTRY_HEAD", "NETWORK_HEAD", "ADMIN", "SUPER_ADMIN"] as const;
```

- [ ] **Step 4: Update `middleware.ts`**

```ts
const ROLE_RANK: Record<string, number> = {
  MEMBER: 0,
  MINISTRY_HEAD: 1,
  NETWORK_HEAD: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};
```

Add a route class (after `isMinistryRoute`):

```ts
  const isNetworkHeadRoute =
    path === "/network-head" || path.startsWith("/network-head/");
```

Include it in the early-exit check (`isAdminRoute || isUsersRoute || isMinistryRoute || isNetworkHeadRoute || isMeRoute`), add the guard before the ministry guard:

```ts
  if (isNetworkHeadRoute && rank(role) < ROLE_RANK.NETWORK_HEAD) {
    const dest = rank(role) >= ROLE_RANK.MINISTRY_HEAD ? "/ministry" : "/me";
    return NextResponse.redirect(new URL(dest, req.url));
  }
```

and add `"/network-head/:path*"` to `config.matcher`. NOTE: `/network` (admin) and `/network-head` must not shadow each other — the prefix checks use exact-or-`prefix + "/"`, so they don't.

- [ ] **Step 5: Run unit tests** — `npx vitest run` — Expected: all pass (nav tests still pass: `memberNavForRole("NETWORK_HEAD")` now includes the Ministry Dashboard item via `hasRole` — acceptable until Task 11 adds the dedicated link).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/authz.ts app/src/middleware.ts tests/unit/authz.test.ts
git commit -m "feat(authz): NETWORK_HEAD role between MINISTRY_HEAD and ADMIN"
```

### Task 3: Welcome shows exactly once

**Files:**
- Modify: `app/src/app/welcome/page.tsx:26-58`
- Modify: `app/src/actions/account.ts` (`completeProfile`)

- [ ] **Step 1: Gate the page on the flag**

In `welcome/page.tsx`, replace the `me` lookup block's lead-in — first select the flag together with the existing fields:

```ts
  const [account] = await db
    .select({ profileCompletedAt: users.profileCompletedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (account?.profileCompletedAt) redirect("/me");
```

Place this immediately after the staff redirects (line 24). Keep the existing membership/join-request secondary skip untouched.

- [ ] **Step 2: Set the flag on completion**

In `completeProfile` (`actions/account.ts`), after the `person` update and mobile upsert, before the join-request block:

```ts
  await db
    .update(users)
    .set({ profileCompletedAt: new Date() })
    .where(eq(users.userId, u.userId));
```

- [ ] **Step 3: Manual smoke** — with dev server on the local DB, a member whose `profile_completed_at` is set lands on `/me` when visiting `/welcome`; clearing the column shows the form again. Verify via: `psql`/node one-off or the preview browser.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/welcome/page.tsx app/src/actions/account.ts
git commit -m "fix(welcome): show profile completion exactly once via profile_completed_at"
```

### Task 4: PH province list

**Files:**
- Create: `app/src/lib/ph-provinces.ts`
- Test: `app/tests/unit/ph-provinces.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { PH_PROVINCES } from "@/lib/ph-provinces";

describe("PH_PROVINCES", () => {
  it("has the NCR entry and 80+ provinces, no duplicates", () => {
    expect(PH_PROVINCES).toContain("Metro Manila (NCR)");
    expect(PH_PROVINCES.length).toBeGreaterThanOrEqual(82);
    expect(new Set(PH_PROVINCES).size).toBe(PH_PROVINCES.length);
  });
  it("is alphabetically sorted after the NCR entry", () => {
    const rest = PH_PROVINCES.slice(1);
    expect([...rest].sort((a, b) => a.localeCompare(b))).toEqual(rest);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/unit/ph-provinces.test.ts` (module not found).

- [ ] **Step 3: Create the list** — NCR first (most common for JLYCC), then all 82 provinces alphabetical:

```ts
// app/src/lib/ph-provinces.ts
// Static PH province list for the /me/profile dropdown. NCR pinned first.
export const PH_PROVINCES: readonly string[] = [
  "Metro Manila (NCR)",
  "Abra", "Agusan del Norte", "Agusan del Sur", "Aklan", "Albay", "Antique",
  "Apayao", "Aurora", "Basilan", "Bataan", "Batanes", "Batangas", "Benguet",
  "Biliran", "Bohol", "Bukidnon", "Bulacan", "Cagayan", "Camarines Norte",
  "Camarines Sur", "Camiguin", "Capiz", "Catanduanes", "Cavite", "Cebu",
  "Cotabato", "Davao de Oro", "Davao del Norte", "Davao del Sur",
  "Davao Occidental", "Davao Oriental", "Dinagat Islands", "Eastern Samar",
  "Guimaras", "Ifugao", "Ilocos Norte", "Ilocos Sur", "Iloilo", "Isabela",
  "Kalinga", "La Union", "Laguna", "Lanao del Norte", "Lanao del Sur",
  "Leyte", "Maguindanao del Norte", "Maguindanao del Sur", "Marinduque",
  "Masbate", "Misamis Occidental", "Misamis Oriental", "Mountain Province",
  "Negros Occidental", "Negros Oriental", "Northern Samar", "Nueva Ecija",
  "Nueva Vizcaya", "Occidental Mindoro", "Oriental Mindoro", "Palawan",
  "Pampanga", "Pangasinan", "Quezon", "Quirino", "Rizal", "Romblon",
  "Samar", "Sarangani", "Siquijor", "Sorsogon", "South Cotabato",
  "Southern Leyte", "Sultan Kudarat", "Sulu", "Surigao del Norte",
  "Surigao del Sur", "Tarlac", "Tawi-Tawi", "Zambales", "Zamboanga del Norte",
  "Zamboanga del Sur", "Zamboanga Sibugay",
] as const;
```

- [ ] **Step 4: Run, expect PASS**, then commit:

```bash
git add app/src/lib/ph-provinces.ts tests/unit/ph-provinces.test.ts
git commit -m "feat(profile): static PH province list"
```

### Task 5: `updateMyProfile` action + shared helper + validation

**Files:**
- Modify: `app/src/lib/validations/account.ts` (add `updateProfileSchema`)
- Modify: `app/src/actions/account.ts` (extract `savePersonBasics`, add `updateMyProfile`)

- [ ] **Step 1: Add the validation schema** (after `completeProfileSchema`)

```ts
export const updateProfileSchema = completeProfileSchema
  .omit({ chapterId: true })
  .extend({
    countryCode: z.string().length(2, "Country required").toUpperCase(),
    province: z.string().trim().max(80).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

- [ ] **Step 2: Extract the shared person+mobile helper in `actions/account.ts`**

Pull the person-update + mobile-upsert block (current lines 150–187 of `completeProfile`) into:

```ts
async function savePersonBasics(
  personId: number,
  d: { firstName: string; lastName: string; mobile?: string; dateOfBirth?: string; gender?: "MALE" | "FEMALE" | "UNDISCLOSED" }
) {
  await db
    .update(person)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      dateOfBirth: d.dateOfBirth ? d.dateOfBirth : null,
      gender: d.gender ?? null,
    })
    .where(eq(person.personId, personId));

  if (d.mobile) {
    const [existingMobile] = await db
      .select({ contactId: contactInfo.contactId })
      .from(contactInfo)
      .where(and(eq(contactInfo.personId, personId), eq(contactInfo.type, "MOBILE")))
      .limit(1);
    if (existingMobile) {
      await db
        .update(contactInfo)
        .set({ value: d.mobile })
        .where(eq(contactInfo.contactId, existingMobile.contactId));
    } else {
      await db.insert(contactInfo).values({
        personId,
        type: "MOBILE",
        value: d.mobile,
        isPrimary: false,
      });
    }
  }
}
```

`completeProfile` calls `savePersonBasics(personId, d)` in place of the inlined block. Behavior identical.

- [ ] **Step 3: Add `updateMyProfile`** (in `actions/account.ts`; new imports: `address`, `personAddress` from `@/schema/core`, `updateProfileSchema`, `isNull` already imported)

```ts
/** /me/profile self-service save: person basics + current HOME address. */
export async function updateMyProfile(formData: FormData) {
  const session = await requireRole("MEMBER");
  const email = session.user?.email;
  if (!email) redirect("/login");

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    mobile: (formData.get("mobile") as string | null) ?? "",
    dateOfBirth: (formData.get("dateOfBirth") as string | null) ?? "",
    gender: formData.get("gender") || undefined,
    countryCode: (formData.get("countryCode") as string | null) ?? "",
    province: (formData.get("province") as string | null) ?? "",
    city: (formData.get("city") as string | null) ?? "",
  };
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/me/profile?err=1");
  }
  const d = parsed.data;

  const [u] = await db
    .select({ userId: users.userId, personId: users.personId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u?.personId) redirect("/welcome");
  const personId = u.personId;

  await savePersonBasics(personId, d);

  // Address upsert: current HOME row (valid_to IS NULL).
  if (d.countryCode) {
    const [current] = await db
      .select({ addressId: personAddress.addressId })
      .from(personAddress)
      .where(
        and(
          eq(personAddress.personId, personId),
          eq(personAddress.type, "HOME"),
          isNull(personAddress.validTo)
        )
      )
      .limit(1);
    if (current) {
      await db
        .update(address)
        .set({
          city: d.city || null,
          province: d.province || null,
          countryCode: d.countryCode,
        })
        .where(eq(address.addressId, current.addressId));
    } else {
      const [created] = await db
        .insert(address)
        .values({
          city: d.city || null,
          province: d.province || null,
          countryCode: d.countryCode,
        })
        .returning({ addressId: address.addressId });
      await db.insert(personAddress).values({
        personId,
        addressId: created.addressId,
        type: "HOME",
        validFrom: new Date().toISOString().slice(0, 10),
      });
    }
  }

  revalidatePath("/me/profile");
  revalidatePath("/me");
  redirect("/me/profile?saved=1");
}
```

- [ ] **Step 4: Typecheck + unit suite** — `npx tsc --noEmit && npx vitest run` — Expected: clean/pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/account.ts app/src/actions/account.ts
git commit -m "feat(profile): updateMyProfile action with HOME address upsert"
```

### Task 6: `/me/profile` page + sidebar entry

**Files:**
- Create: `app/src/app/me/profile/page.tsx`
- Modify: `app/src/lib/member-nav.tsx` (add "My Profile" to `baseItems`, after Overview)

- [ ] **Step 1: Add the nav item** (in `baseItems`, index 1)

```tsx
  {
    href: "/me/profile",
    label: "My Profile",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Create the page**

```tsx
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
  ["OTHER", "Other"],
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
    .innerJoin(person, eq(users.personId, person.personId))
    .innerJoin(member, eq(member.personId, person.personId))
    .innerJoin(lifecycleStage, eq(member.currentStage, lifecycleStage.stageCode))
    .where(eq(users.email, email))
    .limit(1);
  if (!me) redirect("/welcome");

  const [mobileRow] = await db
    .select({ value: contactInfo.value })
    .from(contactInfo)
    .where(and(eq(contactInfo.personId, me.personId!), eq(contactInfo.type, "MOBILE")))
    .limit(1);

  const [home] = await db
    .select({ city: address.city, province: address.province, countryCode: address.countryCode })
    .from(personAddress)
    .innerJoin(address, eq(personAddress.addressId, address.addressId))
    .where(
      and(
        eq(personAddress.personId, me.personId!),
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
        <p className="rounded-md px-4 py-2 text-sm" style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}>
          Profile saved.
        </p>
      )}
      {searchParams.err && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Could not save — please check your entries.
        </p>
      )}

      <div className="card p-6 space-y-4">
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

      <form action={updateMyProfile} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              First name *
            </label>
            <input name="firstName" type="text" required defaultValue={me.firstName} className="input-dark" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Last name *
            </label>
            <input name="lastName" type="text" required defaultValue={me.lastName} className="input-dark" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Mobile number
          </label>
          <input name="mobile" type="tel" placeholder="+63 9XX XXX XXXX" defaultValue={mobileRow?.value ?? ""} className="input-dark" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Birthday
            </label>
            <input name="dateOfBirth" type="date" defaultValue={me.dateOfBirth ?? ""} className="input-dark" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Gender
            </label>
            <select name="gender" defaultValue={me.gender ?? ""} className="input-dark">
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Country
            </label>
            <select name="countryCode" defaultValue={country} className="input-dark">
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code === "OTHER" ? "XX" : code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
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

        <button type="submit" className="btn-accent w-full mt-1">
          Save profile
        </button>
      </form>
    </div>
  );
}
```

Note: the country/province pairing is server-rendered — switching country requires a save+reload to flip dropdown↔free-text. Acceptable v1 (YAGNI); no client JS.

- [ ] **Step 3: Verify in dev** — log in as a member (E2E creds work: any `e2e-member-*` user / `password123`, or admin), open `/me/profile`, save a province, reload, value persists. Check `core.address` row created with NULL `line1`.

- [ ] **Step 4: Run nav unit tests** — `npx vitest run tests/unit` — the member-nav test may assert exact item lists; update it to include the new "My Profile" item if it fails.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/me/profile/page.tsx app/src/lib/member-nav.tsx tests/unit
git commit -m "feat(me): self-service /me/profile page with country/province"
```

### Task 7: Stage chip on `/me`

**Files:**
- Modify: `app/src/app/me/page.tsx:86-95` (header MotionCard)

- [ ] **Step 1: Add the chip** — `me.currentStage` and `ladder` are already loaded on this page. Resolve the display name and render next to the greeting:

```tsx
const stageName =
  ladder.find((s) => s.stageCode === me.currentStage)?.name ?? me.currentStage;
```

In the header MotionCard, change the `<h1>` block to:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {greeting}, {me.firstName}
          </h1>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
          >
            {stageName}
          </span>
        </div>
```

(Adjust `ladder` field names to the actual select in `me/page.tsx` — it selects from `lifecycleStage`; confirm the property is `stageCode`/`name` and adapt.)

- [ ] **Step 2: Verify in dev** — `/me` shows e.g. "Regular Member" chip beside the greeting.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/me/page.tsx
git commit -m "feat(me): lifecycle stage chip in dashboard header"
```

### Task 8: Phase 1 E2E

**Files:**
- Create: `app/tests/e2e/profile.spec.ts`

- [ ] **Step 1: Write the spec** (mirror the login helper style of `member-dashboard.spec.ts`; signup creates a fresh member so the welcome flag starts NULL — credentials signup marks no flag, but `provisionMemberProfile` links a person, so set the flag scenario explicitly via DB)

```ts
import { test, expect } from "@playwright/test";
import postgres from "postgres";

const LOCAL_DB = "postgresql://jly_admin:localdevpassword@localhost:5432/jly";

async function login(page, email: string, password: string, dest: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**${dest}**`);
}

test("welcome shows once: flag set -> /welcome bounces to /me", async ({ page }) => {
  const email = `e2e-profile-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"]', "Profile");
  await page.fill('input[name="lastName"]', "Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/login**");

  // Simulate completed welcome.
  const sql = postgres(LOCAL_DB, { max: 1 });
  await sql`update app.users set profile_completed_at = now() where email = ${email}`;
  await sql.end();

  await login(page, email, "password123", "/me");
  await page.goto("/welcome");
  await page.waitForURL("**/me**");
  await expect(page).not.toHaveURL(/welcome/);
});

test("my profile: edit province round-trip + stage chip visible", async ({ page }) => {
  const email = `e2e-profile2-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"]', "Prov");
  await page.fill('input[name="lastName"]', "Round");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/login**");
  const sql = postgres(LOCAL_DB, { max: 1 });
  await sql`update app.users set profile_completed_at = now() where email = ${email}`;
  await sql.end();

  await login(page, email, "password123", "/me");
  await expect(page.getByText("Regular Member").first()).toBeVisible();

  await page.goto("/me/profile");
  await page.selectOption('select[name="province"]', "Cavite");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/me/profile?saved=1**");
  await page.goto("/me/profile");
  await expect(page.locator('select[name="province"]')).toHaveValue("Cavite");
});
```

Adapt selectors to the actual `/signup` form field names (check `app/src/app/signup/page.tsx` before running; if signup lands elsewhere adjust `waitForURL`). New members from credentials signup start at stage `REGULAR_MEMBER` (set by `provisionMemberProfile` — verify; if FTV, assert that name instead).

- [ ] **Step 2: Run** — `$env:DATABASE_URL='postgresql://jly_admin:localdevpassword@localhost:5432/jly'; npx playwright test tests/e2e/profile.spec.ts` — Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/profile.spec.ts
git commit -m "test(e2e): one-time welcome + profile round-trip"
```

---

## Phase 2 — appointment hierarchy

### Task 9: Migration V071 + `networkLeader` schema

**Files:**
- Create: `db/migrations/V071__ministries_network_leader.sql`
- Modify: `app/src/schema/ministries.ts`

- [ ] **Step 1: Migration**

```sql
-- db/migrations/V071__ministries_network_leader.sql
CREATE TABLE ministries.network_leader (
  leader_id    BIGSERIAL PRIMARY KEY,
  network_id   BIGINT NOT NULL REFERENCES ministries.network(network_id),
  member_id    BIGINT NOT NULL REFERENCES membership.member(member_id),
  appointed_by BIGINT REFERENCES membership.member(member_id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_head_per_network
  ON ministries.network_leader(network_id) WHERE ended_at IS NULL;
CREATE INDEX idx_network_leader_member ON ministries.network_leader(member_id);
COMMENT ON TABLE ministries.network_leader IS
  'Network head appointments. One active head per network (partial unique).';
```

- [ ] **Step 2: Apply locally** (same flyway command as Task 1) — Expected: V071 applied.

- [ ] **Step 3: Drizzle schema** — append to `ministries.ts`:

```ts
export const networkLeader = ministriesSchema.table("network_leader", {
  leaderId: bigserial("leader_id", { mode: "number" }).primaryKey(),
  networkId: bigint("network_id", { mode: "number" })
    .notNull()
    .references(() => network.networkId),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId),
  appointedBy: bigint("appointed_by", { mode: "number" }).references(() => member.memberId),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add db/migrations/V071__ministries_network_leader.sql app/src/schema/ministries.ts
git commit -m "feat(db): ministries.network_leader appointments table"
```

### Task 10: Network-head appointment actions + `/users` panel

**Files:**
- Create: `app/src/actions/network-leaders.ts`
- Modify: `app/src/app/(admin)/users/page.tsx` (Network Heads panel below the table)

- [ ] **Step 1: Actions**

```ts
// app/src/actions/network-leaders.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { network, networkLeader, ministryMembership } from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Resolve the acting user's member_id (for appointed_by). Nullable. */
async function actorMemberId(email: string): Promise<number | null> {
  const [row] = await db
    .select({ memberId: member.memberId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);
  return row?.memberId ?? null;
}

/** Role fallback when a headship ends: MINISTRY_HEAD if still heads a chapter, else MEMBER. Never touches ADMIN+. */
async function syncRoleAfterRemoval(memberId: number) {
  const [m] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);
  if (!m) return;
  const [account] = await db
    .select({ userId: users.userId, role: users.role })
    .from(users)
    .where(eq(users.personId, m.personId))
    .limit(1);
  if (!account || account.role === "ADMIN" || account.role === "SUPER_ADMIN") return;

  const [otherNetwork] = await db
    .select({ id: networkLeader.leaderId })
    .from(networkLeader)
    .where(and(eq(networkLeader.memberId, memberId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (otherNetwork) return; // still a network head elsewhere

  const [headship] = await db
    .select({ id: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  await db
    .update(users)
    .set({ role: headship ? "MINISTRY_HEAD" : "MEMBER" })
    .where(eq(users.userId, account.userId));
}

export async function appointNetworkHead(formData: FormData) {
  const session = await requireRole("ADMIN");
  const networkId = Number(formData.get("networkId"));
  const memberId = Number(formData.get("memberId"));
  if (!networkId || !memberId) return { error: "Network and member required" };

  const [existing] = await db
    .select({ id: networkLeader.leaderId })
    .from(networkLeader)
    .where(and(eq(networkLeader.networkId, networkId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (existing) return { error: "This network already has an active head — remove them first" };

  await db.insert(networkLeader).values({
    networkId,
    memberId,
    appointedBy: await actorMemberId(session.user!.email!),
  });

  // Role sync: promote linked account (never demote ADMIN+).
  const [m] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);
  if (m) {
    const [account] = await db
      .select({ userId: users.userId, role: users.role })
      .from(users)
      .where(eq(users.personId, m.personId))
      .limit(1);
    if (account && (account.role === "MEMBER" || account.role === "MINISTRY_HEAD")) {
      await db.update(users).set({ role: "NETWORK_HEAD" }).where(eq(users.userId, account.userId));
    }
  }

  revalidatePath("/users");
  return { success: true };
}

export async function removeNetworkHead(formData: FormData) {
  await requireRole("ADMIN");
  const leaderId = Number(formData.get("leaderId"));
  if (!leaderId) return { error: "Appointment id required" };

  const [row] = await db
    .select({ memberId: networkLeader.memberId })
    .from(networkLeader)
    .where(and(eq(networkLeader.leaderId, leaderId), isNull(networkLeader.endedAt)))
    .limit(1);
  if (!row) return { error: "Active appointment not found" };

  await db
    .update(networkLeader)
    .set({ endedAt: new Date() })
    .where(eq(networkLeader.leaderId, leaderId));
  await syncRoleAfterRemoval(row.memberId);

  revalidatePath("/users");
  return { success: true };
}

/** Networks with current head + eligible appointees, for the /users panel. */
export async function networkHeadOverview() {
  const networks = await db
    .select({ networkId: network.networkId, name: network.name })
    .from(network)
    .orderBy(asc(network.name));

  const heads = await db
    .select({
      leaderId: networkLeader.leaderId,
      networkId: networkLeader.networkId,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(isNull(networkLeader.endedAt));

  // Candidates: any active account with a linked member profile.
  const candidates = await db
    .select({
      memberId: member.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: users.email,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.isActive, true))
    .orderBy(asc(person.lastName));

  return { networks, heads, candidates };
}
```

- [ ] **Step 2: `/users` panel** — in `users/page.tsx`, import `networkHeadOverview`, `appointNetworkHead`, `removeNetworkHead`; call `const nh = await networkHeadOverview();` and render after the users table card:

```tsx
      <div className="card overflow-x-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Network Heads
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            One head per network. Network heads appoint ministry heads.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-4 font-medium">Network</th>
              <th className="py-2 pr-4 font-medium">Current head</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {nh.networks.map((n) => {
              const head = nh.heads.find((h) => h.networkId === n.networkId);
              return (
                <tr key={n.networkId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{n.name}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {head ? `${head.firstName} ${head.lastName}` : "—"}
                  </td>
                  <td className="py-2">
                    {head ? (
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      <form action={removeNetworkHead as any}>
                        <input type="hidden" name="leaderId" value={head.leaderId} />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
                          Remove
                        </button>
                      </form>
                    ) : (
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      <form action={appointNetworkHead as any} className="flex items-center gap-2">
                        <input type="hidden" name="networkId" value={n.networkId} />
                        <select name="memberId" className="rounded-md px-2 py-1 text-sm" style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          {nh.candidates.map((c) => (
                            <option key={c.memberId} value={c.memberId}>
                              {c.firstName} {c.lastName} ({c.email})
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="text-xs underline" style={{ color: "var(--text-primary)" }}>
                          Appoint
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
```

- [ ] **Step 3: Verify in dev** — as super admin on `/users`: appoint a member as Eagles head → their role flips to NETWORK_HEAD (check users table); Remove → role falls back.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add app/src/actions/network-leaders.ts "app/src/app/(admin)/users/page.tsx"
git commit -m "feat(users): appoint/remove network heads with role sync"
```

### Task 11: `/network-head` dashboard + appoint ministry heads

**Files:**
- Create: `app/src/app/network-head/page.tsx`
- Create: `app/src/app/network-head/layout.tsx` (member-shell wrapper — copy the pattern of `app/src/app/ministry/layout.tsx`)
- Modify: `app/src/actions/network-leaders.ts` (add network-scoped head appointment)
- Modify: `app/src/lib/member-nav.tsx` (Network Dashboard link for NETWORK_HEAD+)

- [ ] **Step 1: Add network-scoped actions** (append to `network-leaders.ts`)

```ts
/** Active network ids the acting user heads. */
export async function myNetworkIds(): Promise<number[]> {
  const session = await requireRole("NETWORK_HEAD");
  const rows = await db
    .select({ networkId: networkLeader.networkId })
    .from(networkLeader)
    .innerJoin(member, eq(networkLeader.memberId, member.memberId))
    .innerJoin(users, eq(users.personId, member.personId))
    .where(and(eq(users.email, session.user!.email!), isNull(networkLeader.endedAt)));
  return rows.map((r) => r.networkId);
}
```

```ts
/** Network head appoints/removes a chapter HEAD within their own network. */
export async function setChapterHeadAsNetworkHead(formData: FormData) {
  await requireRole("NETWORK_HEAD");
  const membershipId = Number(formData.get("membershipId"));
  const makeHead = formData.get("makeHead") === "1";
  const myNets = await myNetworkIds();

  // Ownership: the membership's chapter must belong to one of my networks.
  const [target] = await db
    .select({ networkId: ministry.networkId })
    .from(ministryMembership)
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(ministryMembership.membershipId, membershipId))
    .limit(1);
  if (!target || !myNets.includes(target.networkId)) {
    return { error: "That chapter is not in your network" };
  }

  const result = await applyChapterHeadChange(membershipId, makeHead);
  revalidatePath("/network-head");
  return result;
}
```

`applyChapterHeadChange` is the existing eligibility + role-sync body of `setLeaderRole` (ministries.ts lines 443–515) **extracted** into an exported helper in `app/src/actions/ministries.ts`:

```ts
/** Shared by admin setLeaderRole and network-head appointment. HEAD only when eligible; syncs account role. */
export async function applyChapterHeadChange(
  membershipId: number,
  makeHead: boolean
): Promise<{ success: true } | { error: string }> {
  // body = current setLeaderRole try-block with:
  //   isLeader := makeHead, leaderRole := makeHead ? "HEAD" : null
  // (verbatim move; setLeaderRole keeps its ADMIN gate and general
  //  ASSISTANT_HEAD/COORDINATOR path, delegating the HEAD path here)
}
```

Import `ministry`, `ministryChapter`, `ministryMembership` in `network-leaders.ts` (already imported partially).

- [ ] **Step 2: Nav link** — in `member-nav.tsx` add after `headItem`:

```tsx
const networkHeadItem: ShellNavItem = {
  href: "/network-head",
  label: "Network Dashboard",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <path strokeLinecap="round" d="M12 8v4m0 0l-5 4.5M12 12l5 4.5" />
    </svg>
  ),
};
```

and in `memberNavForRole`:

```ts
  if (hasRole(role, "NETWORK_HEAD")) items.push(networkHeadItem);
```

(placed after the `MINISTRY_HEAD` push so order is Ministry → Network → Admin).

- [ ] **Step 3: Layout** — `app/src/app/network-head/layout.tsx`: copy `app/src/app/ministry/layout.tsx` verbatim (same shell + `memberNavForRole`), only the import paths/title change if any are layout-specific.

- [ ] **Step 4: Page**

```tsx
// app/src/app/network-head/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { network, ministry, ministryChapter, ministryMembership } from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { branch } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { myNetworkIds, setChapterHeadAsNetworkHead } from "@/actions/network-leaders";
import { ListSearch } from "@/components/members/list-search";
import { and, asc, eq, inArray, isNull, or, ilike } from "drizzle-orm";

export default async function NetworkHeadPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireRole("NETWORK_HEAD");
  const nets = await myNetworkIds();
  if (nets.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-6 md:px-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Network Dashboard</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          You are not assigned as head of any network.
        </p>
      </div>
    );
  }
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const [net] = await db
    .select({ name: network.name, description: network.description })
    .from(network)
    .where(inArray(network.networkId, nets))
    .limit(1);

  // Chapters in my network(s) with current head + eligible members.
  const rows = await db
    .select({
      membershipId: ministryMembership.membershipId,
      ministryName: ministry.name,
      branchName: branch.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      isLeader: ministryMembership.isLeader,
      leaderRole: ministryMembership.leaderRole,
    })
    .from(ministryMembership)
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(branch, eq(ministryChapter.branchId, branch.branchId))
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        inArray(ministry.networkId, nets),
        isNull(ministryMembership.endedAt),
        query.length > 0
          ? or(ilike(person.firstName, `%${query}%`), ilike(person.lastName, `%${query}%`))
          : undefined
      )
    )
    .orderBy(asc(ministry.name), asc(person.lastName));

  const eligible = (stage: string) => stage === "INNER_CORE" || stage === "JOSHUA_GENERATION";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {net?.name} Network
        </h1>
        {net?.description && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{net.description}</p>
        )}
      </div>

      <div className="card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Members & Ministry Heads
          </h2>
          <ListSearch action="/network-head" defaultValue={query} variant="lime" />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {query ? `No members match "${query}".` : "No members in your network yet."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Ministry / Branch</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.membershipId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {r.ministryName} — {r.branchName}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{r.currentStage}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {r.isLeader && r.leaderRole === "HEAD" ? "Ministry Head" : "Member"}
                  </td>
                  <td className="py-2">
                    {r.isLeader && r.leaderRole === "HEAD" ? (
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      <form action={setChapterHeadAsNetworkHead as any}>
                        <input type="hidden" name="membershipId" value={r.membershipId} />
                        <input type="hidden" name="makeHead" value="0" />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
                          Remove head
                        </button>
                      </form>
                    ) : eligible(r.currentStage) ? (
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      <form action={setChapterHeadAsNetworkHead as any}>
                        <input type="hidden" name="membershipId" value={r.membershipId} />
                        <input type="hidden" name="makeHead" value="1" />
                        <button type="submit" className="text-xs underline" style={{ color: "var(--text-primary)" }}>
                          Appoint head
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>not eligible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in dev** — appoint a network head on `/users`, log in as them (set a password hash directly in local DB if Google-only), open `/network-head`: see network banner + members; appoint an eligible member → their role flips to MINISTRY_HEAD; remove → falls back.

- [ ] **Step 6: tsc + unit + commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/src/app/network-head app/src/actions/network-leaders.ts app/src/actions/ministries.ts app/src/lib/member-nav.tsx tests/unit
git commit -m "feat(network-head): dashboard with scoped ministry-head appointment"
```

(Update the member-nav unit test for the new NETWORK_HEAD case: `memberNavForRole("NETWORK_HEAD")` includes Ministry Dashboard + Network Dashboard, not Admin Portal.)

### Task 12: Ministry Head stage promotion

**Files:**
- Create: `app/src/actions/promotion.ts`
- Create: `app/src/lib/stage-promotion.ts` (pure helper)
- Modify: `app/src/app/ministry/page.tsx` (Promote button in roster)
- Test: `app/tests/unit/stage-promotion.test.ts`

- [ ] **Step 1: Failing unit test for the pure helper**

```ts
import { describe, expect, it } from "vitest";
import { nextPromotionStage } from "@/lib/stage-promotion";

describe("nextPromotionStage", () => {
  it("steps REGULAR_MEMBER -> JOSHUA_GENERATION -> INNER_CORE", () => {
    expect(nextPromotionStage("REGULAR_MEMBER")).toBe("JOSHUA_GENERATION");
    expect(nextPromotionStage("JOSHUA_GENERATION")).toBe("INNER_CORE");
  });
  it("returns null at the top and for non-promotable stages", () => {
    expect(nextPromotionStage("INNER_CORE")).toBeNull();
    expect(nextPromotionStage("FTV")).toBeNull();
    expect(nextPromotionStage("DFL")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**, then implement:

```ts
// app/src/lib/stage-promotion.ts
// Ministry-head promotion ladder. Only these two hops are allowed;
// earlier stages (FTV/OGV/RA) move through the normal membership flow.
const PROMOTION_LADDER: Record<string, string> = {
  REGULAR_MEMBER: "JOSHUA_GENERATION",
  JOSHUA_GENERATION: "INNER_CORE",
};

export function nextPromotionStage(current: string): string | null {
  return PROMOTION_LADDER[current] ?? null;
}
```

- [ ] **Step 3: Run, expect PASS.**

- [ ] **Step 4: Server action**

```ts
// app/src/actions/promotion.ts
"use server";

import { db } from "@/lib/db";
import { member, lifecycleStageHistory } from "@/schema/membership";
import { ministryMembership } from "@/schema/ministries";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { headChapterIds } from "@/actions/join-requests";
import { nextPromotionStage } from "@/lib/stage-promotion";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Ministry head promotes a chapter member one lifecycle step (max INNER_CORE). */
export async function promoteMember(formData: FormData) {
  const session = await requireRole("MINISTRY_HEAD");
  const membershipId = Number(formData.get("membershipId"));
  if (!membershipId) return { error: "Membership required" };

  const chapters = await headChapterIds();
  const [target] = await db
    .select({
      memberId: ministryMembership.memberId,
      chapterId: ministryMembership.chapterId,
      currentStage: member.currentStage,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .where(
      and(eq(ministryMembership.membershipId, membershipId), isNull(ministryMembership.endedAt))
    )
    .limit(1);
  if (!target || !chapters.includes(target.chapterId)) {
    return { error: "Member is not in a chapter you lead" };
  }

  const next = nextPromotionStage(target.currentStage);
  if (!next) return { error: "Member is already at the top of the promotion ladder" };

  // The DB trigger on member.current_stage records the history row;
  // stamp the actor on the newest row right after.
  await db.update(member).set({ currentStage: next }).where(eq(member.memberId, target.memberId));

  const [actor] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.email, session.user!.email!))
    .limit(1);
  if (actor?.personId) {
    const [latest] = await db
      .select({ historyId: lifecycleStageHistory.historyId })
      .from(lifecycleStageHistory)
      .where(eq(lifecycleStageHistory.memberId, target.memberId))
      .orderBy(desc(lifecycleStageHistory.changedAt))
      .limit(1);
    if (latest) {
      await db
        .update(lifecycleStageHistory)
        .set({ changedByPersonId: actor.personId, reason: "Promoted by ministry head" })
        .where(eq(lifecycleStageHistory.historyId, latest.historyId));
    }
  }

  revalidatePath("/ministry");
  return { success: true };
}
```

`lifecycleStageHistory` must exist in `app/src/schema/membership.ts` — add it (table `lifecycle_stage_history`, columns: `historyId` bigserial PK, `memberId` bigint notNull, `fromStage` text, `toStage` text notNull, `changedAt` timestamptz notNull defaultNow, `effectiveFrom` date, `changedByPersonId` bigint, `reason` text).

- [ ] **Step 5: Promote button in `/ministry` roster** — in `ministry/page.tsx`, also select `currentStage` per row (already selected) and `membershipId` (already selected). Add an "Action" column to the roster table:

```tsx
import { promoteMember } from "@/actions/promotion";
import { nextPromotionStage } from "@/lib/stage-promotion";
```

Header: `<th className="py-2 font-medium">Action</th>`. Row cell:

```tsx
                  <td className="py-2">
                    {nextPromotionStage(m.currentStage) ? (
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      <form action={promoteMember as any}>
                        <input type="hidden" name="membershipId" value={m.membershipId} />
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 underline">
                          Promote to {nextPromotionStage(m.currentStage) === "JOSHUA_GENERATION" ? "Joshua Generation" : "Inner Core"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
```

- [ ] **Step 6: tsc + unit + commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/src/actions/promotion.ts app/src/lib/stage-promotion.ts app/src/schema/membership.ts app/src/app/ministry/page.tsx tests/unit/stage-promotion.test.ts
git commit -m "feat(ministry): one-step stage promotion up to Inner Core"
```

### Task 13: Phase 2 E2E

**Files:**
- Create: `app/tests/e2e/appointment-chain.spec.ts`

- [ ] **Step 1: Write the spec** — seed via direct DB (global-setup pattern): create a member user with password, membership in the E2E chapter at INNER_CORE stage; then drive the chain through the UI as `admin@jly.church`:

```ts
import { test, expect } from "@playwright/test";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const LOCAL_DB = "postgresql://jly_admin:localdevpassword@localhost:5432/jly";

async function loginAdmin(page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@jly.church");
  await page.fill('input[name="password"]', "changeme");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/members**");
}

test("admin appoints network head; role flips; removal restores", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-nethead-${stamp}@example.com`;
  const sql = postgres(LOCAL_DB, { max: 1 });
  const hash = bcrypt.hashSync("password123", 10);
  const [p] = await sql`insert into core.person (first_name, last_name) values ('Net', ${"Head" + stamp}) returning person_id`;
  const [b] = await sql`select branch_id from core.branch where code = 'E2E-MAIN'`;
  const [m] = await sql`insert into membership.member (person_id, branch_id, member_code, current_stage, joined_at)
    values (${p.person_id}, ${b.branch_id}, ${"E2E-NH-" + stamp}, 'INNER_CORE', now()) returning member_id`;
  await sql`insert into app.users (email, name, password_hash, role, person_id)
    values (${email}, 'Net Head', ${hash}, 'MEMBER', ${p.person_id})`;
  await sql.end();

  await loginAdmin(page);
  await page.goto("/users");
  const row = page.locator("tr", { hasText: "E2E Network" }).first();
  // The candidates dropdown lists by "First Last (email)".
  await row.locator('select[name="memberId"]').selectOption({ label: `Net Head${stamp} (${email})` });
  await row.locator('button:has-text("Appoint")').click();
  await page.waitForLoadState("networkidle");

  const sql2 = postgres(LOCAL_DB, { max: 1 });
  const [u] = await sql2`select role from app.users where email = ${email}`;
  expect(u.role).toBe("NETWORK_HEAD");

  // Cleanup keeps the seed network reusable.
  await sql2`update ministries.network_leader set ended_at = now() where member_id = ${m.member_id}`;
  await sql2`update app.users set role = 'MEMBER' where email = ${email}`;
  await sql2.end();
});

test("ministry head promotes a chapter member one step", async ({ page }) => {
  const stamp = Date.now();
  const sql = postgres(LOCAL_DB, { max: 1 });
  const hash = bcrypt.hashSync("password123", 10);
  const [b] = await sql`select branch_id from core.branch where code = 'E2E-MAIN'`;
  const [ch] = await sql`select c.chapter_id from ministries.ministry_chapter c
    join ministries.ministry mi on mi.ministry_id = c.ministry_id
    where mi.code = 'E2E-MIN' limit 1`;

  // Head account.
  const headEmail = `e2e-mhead-${stamp}@example.com`;
  const [hp] = await sql`insert into core.person (first_name, last_name) values ('Min', ${"Head" + stamp}) returning person_id`;
  const [hm] = await sql`insert into membership.member (person_id, branch_id, member_code, current_stage, joined_at)
    values (${hp.person_id}, ${b.branch_id}, ${"E2E-MH-" + stamp}, 'INNER_CORE', now()) returning member_id`;
  await sql`insert into app.users (email, name, password_hash, role, person_id)
    values (${headEmail}, 'Min Head', ${hash}, 'MINISTRY_HEAD', ${hp.person_id})`;
  await sql`insert into ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
    values (${ch.chapter_id}, ${hm.member_id}, now(), true, 'HEAD')`;

  // Promotable member in the same chapter.
  const [mp] = await sql`insert into core.person (first_name, last_name) values ('Promo', ${"Tee" + stamp}) returning person_id`;
  const [mm] = await sql`insert into membership.member (person_id, branch_id, member_code, current_stage, joined_at)
    values (${mp.person_id}, ${b.branch_id}, ${"E2E-PR-" + stamp}, 'REGULAR_MEMBER', now()) returning member_id`;
  await sql`insert into ministries.ministry_membership (chapter_id, member_id, joined_at)
    values (${ch.chapter_id}, ${mm.member_id}, now())`;
  await sql.end();

  await page.goto("/login");
  await page.fill('input[name="email"]', headEmail);
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/ministry**");

  const row = page.locator("tr", { hasText: `Promo Tee${stamp}` });
  await row.locator('button:has-text("Promote")').click();
  await page.waitForLoadState("networkidle");

  const sql2 = postgres(LOCAL_DB, { max: 1 });
  const [after] = await sql2`select current_stage from membership.member where member_id = ${mm.member_id}`;
  expect(after.current_stage).toBe("JOSHUA_GENERATION");
  const [hist] = await sql2`select to_stage, changed_by_person_id from membership.lifecycle_stage_history
    where member_id = ${mm.member_id} order by changed_at desc limit 1`;
  expect(hist.to_stage).toBe("JOSHUA_GENERATION");
  await sql2.end();
});
```

Adapt waits/selectors after first run (credentials login for MINISTRY_HEAD lands on `/ministry` per `actions/auth.ts:13`).

- [ ] **Step 2: Run** — `$env:DATABASE_URL='postgresql://jly_admin:localdevpassword@localhost:5432/jly'; npx playwright test tests/e2e/appointment-chain.spec.ts` — Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/appointment-chain.spec.ts
git commit -m "test(e2e): network-head appointment and stage promotion chain"
```

### Task 14: Full verification + finish

- [ ] **Step 1:** `npx tsc --noEmit` — clean.
- [ ] **Step 2:** `npx vitest run` — all pass (≥298 + new).
- [ ] **Step 3:** `npm run build` — clean prod build.
- [ ] **Step 4:** Full E2E vs local DB: `$env:DATABASE_URL='postgresql://jly_admin:localdevpassword@localhost:5432/jly'; npx playwright test tests/e2e/profile.spec.ts tests/e2e/appointment-chain.spec.ts tests/e2e/member-dashboard.spec.ts tests/e2e/roles-journey.spec.ts` — all pass.
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch — push branch, open PR to master. Prod rollout note for the PR body: **run Flyway migrate vs Neon (V070+V071) BEFORE deploying to Vercel** (the welcome gate reads the new column).

## Self-review notes

- Spec coverage: welcome flag (T1/T3), backfill (T1), `/me/profile` + country/province (T4–T6), stage chip (T7), NETWORK_HEAD ladder+middleware (T2), network_leader (T9), admin appoint UI (T10), `/network-head` (T11), promotion (T12), error handling baked into actions, tests (T2/T4/T8/T12/T13/T14). No gaps.
- Naming consistency: `applyChapterHeadChange` (T11) referenced once and defined once; `nextPromotionStage` (T12) used in page + action; `myNetworkIds` defined and used in T11.
- Known judgment calls: `/users` panel is per-network (one head per seat) instead of per-user control — same requirement, simpler UI. Country switch needs save+reload (no client JS) — v1 acceptable.
