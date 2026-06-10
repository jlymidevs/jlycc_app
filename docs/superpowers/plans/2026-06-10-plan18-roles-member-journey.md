# Roles, Member Login & Christian Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four-role access (SUPER_ADMIN / ADMIN / MINISTRY_HEAD / MEMBER), member self-signup with FB-style ministry-join requests carrying priority ranks, universal member profiles (`/me`), head dashboard with approve/reject + roster monitoring (`/ministry`), super-admin user management (`/users`), and head-eligibility rule (Inner Core / Joshua Generation only).

**Architecture:** Extend existing `app.users.role` text column to 4 values enforced by DB CHECK. Every user links to `core.person` (+ auto-created `membership.member` at stage REGULAR_MEMBER). Ministry joining via new `ministries.join_request` table; approval creates the existing `ministry_membership` row with a new `priority` column. Role carried in NextAuth JWT; guards in middleware + `requireRole` helper in server actions.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Drizzle ORM, NextAuth v5 beta (JWT), Zod, bcryptjs, Vitest, Playwright, Flyway SQL migrations.

**Spec:** `docs/superpowers/specs/2026-06-10-roles-and-member-journey-design.md`

**Conventions in this codebase (follow them):**
- Server actions live in `app/src/actions/*.ts`, start with `"use server"`, parse `FormData`, validate with Zod `safeParse`, return `{ errors }` on failure, `revalidatePath` + `redirect` on success.
- Drizzle bigint FK inserts use `as any` casts with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
- Unit tests import via `@/` alias, plain Vitest, no DB mocking — only pure functions and Zod schemas get unit tests.
- All app commands run from `app/`. Migrations live in `db/migrations/`.
- Person email lives in `core.contact_info` (type `'EMAIL'`), not on `core.person`.
- Member code pattern: `M-${personId}`. Member requires `branchId` — auto-provisioning uses the lowest `branch_id` (main branch).
- E2E staff login: fill `/login` with `admin@jly.church` / `changeme`, wait for `/members`.

---

### Task 1: Database migrations

**Files:**
- Modify: `db/migrations/R__seed_lifecycle_stages.sql`
- Create: `db/migrations/V068__app_users_roles.sql`
- Create: `db/migrations/V069__ministries_join_request.sql`

- [ ] **Step 1: Extend lifecycle stage seed**

Replace the full contents of `db/migrations/R__seed_lifecycle_stages.sql` with:

```sql
INSERT INTO membership.lifecycle_stage (stage_code, name, description, order_index, is_terminal) VALUES
  ('FTV',               'First Time Visitor', 'Someone who has attended at least once.',            10, false),
  ('OGV',               'Ongoing Visitor',    'Visits intermittently but not weekly.',              20, false),
  ('RA',                'Regular Attendee',   'Attends regularly; not yet a member.',               30, false),
  ('REGULAR_MEMBER',    'Regular Member',     'Has met membership criteria.',                       40, false),
  ('JOSHUA_GENERATION', 'Joshua Generation',  'Committed member raised up for service.',            50, false),
  ('INNER_CORE',        'Inner Core',         'Core leadership-track member.',                      60, false),
  ('DFL',               'Drop From List',     'Not interested or no longer pursued.',               99, true)
ON CONFLICT (stage_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  is_terminal = EXCLUDED.is_terminal;
```

- [ ] **Step 2: Create V068**

Create `db/migrations/V068__app_users_roles.sql`:

```sql
-- Four-role account system + person link + active flag.
ALTER TABLE app.users ADD COLUMN person_id bigint UNIQUE REFERENCES core.person(person_id);
ALTER TABLE app.users ADD COLUMN is_active boolean NOT NULL DEFAULT true;

UPDATE app.users SET role = 'ADMIN' WHERE role = 'staff';
UPDATE app.users SET role = 'SUPER_ADMIN' WHERE email = 'admin@jly.church';

ALTER TABLE app.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','MINISTRY_HEAD','MEMBER'));
```

- [ ] **Step 3: Create V069**

Create `db/migrations/V069__ministries_join_request.sql`:

```sql
-- FB-style ministry join requests with priority ranks.
CREATE TYPE ministries.join_request_status AS ENUM ('PENDING','APPROVED','REJECTED');

CREATE TABLE ministries.join_request (
  request_id            bigserial PRIMARY KEY,
  member_id             bigint NOT NULL REFERENCES membership.member(member_id) ON DELETE CASCADE,
  chapter_id            bigint NOT NULL REFERENCES ministries.ministry_chapter(chapter_id) ON DELETE CASCADE,
  priority              smallint NOT NULL CHECK (priority >= 1),
  status                ministries.join_request_status NOT NULL DEFAULT 'PENDING',
  requested_at          timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz,
  decided_by_member_id  bigint REFERENCES membership.member(member_id)
);

-- One pending request per member per chapter.
CREATE UNIQUE INDEX join_request_pending_unique
  ON ministries.join_request (member_id, chapter_id) WHERE status = 'PENDING';

CREATE INDEX join_request_chapter_pending_idx
  ON ministries.join_request (chapter_id) WHERE status = 'PENDING';

-- Priority rank carried onto membership when approved.
ALTER TABLE ministries.ministry_membership ADD COLUMN priority smallint;

GRANT SELECT, INSERT, UPDATE ON ministries.join_request TO app_writer;
GRANT USAGE, SELECT ON SEQUENCE ministries.join_request_request_id_seq TO app_writer;
GRANT SELECT ON ministries.join_request TO app_reader;
```

Note: check `db/migrations/V063__plan4_roles_and_grants.sql` for the exact role names used by GRANTs in this DB; if grants there use different role names (or a default-privileges approach), mirror that pattern instead.

- [ ] **Step 4: Run migrations locally (if Docker DB is up)**

Run from `db/`: `docker compose up -d` then check Flyway container logs for `Successfully applied`.
If no local DB available this session: skip, note it in the final report.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/R__seed_lifecycle_stages.sql db/migrations/V068__app_users_roles.sql db/migrations/V069__ministries_join_request.sql
git commit -m "feat(db): user roles, person link, ministry join requests with priority"
```

---

### Task 2: Drizzle schema updates

**Files:**
- Modify: `app/src/schema/app.ts`
- Modify: `app/src/schema/ministries.ts`

- [ ] **Step 1: Update `app/src/schema/app.ts`**

Replace full contents:

```ts
// app/src/schema/app.ts
import {
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";
import { person } from "./core";

export const appSchema = pgSchema("app");

export const users = appSchema.table("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("MEMBER"),
  personId: bigint("person_id", { mode: "number" })
    .unique()
    .references(() => person.personId),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Add join request table to `app/src/schema/ministries.ts`**

Add `smallint` to the drizzle-orm/pg-core import list, then append at the end of the file:

```ts
export const joinRequestStatusEnum = ministriesSchema.enum(
  "join_request_status",
  ["PENDING", "APPROVED", "REJECTED"]
);

export const joinRequest = ministriesSchema.table("join_request", {
  requestId: bigserial("request_id", { mode: "number" }).primaryKey(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId, { onDelete: "cascade" }),
  chapterId: bigint("chapter_id", { mode: "number" })
    .notNull()
    .references(() => ministryChapter.chapterId, { onDelete: "cascade" }),
  priority: smallint("priority").notNull(),
  status: joinRequestStatusEnum("status").notNull().default("PENDING"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedByMemberId: bigint("decided_by_member_id", {
    mode: "number",
  }).references(() => member.memberId),
});
```

Also add `priority: smallint("priority"),` to the existing `ministryMembership` table definition (after `leaderRole`).

- [ ] **Step 3: Verify compile**

Run from `app/`: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/schema/app.ts src/schema/ministries.ts
git commit -m "feat(schema): users role/person/isActive + join_request table"
```

---

### Task 3: Role hierarchy helper (`authz`)

**Files:**
- Create: `app/src/lib/authz.ts`
- Test: `app/tests/unit/authz.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/authz.test.ts`:

```ts
// app/tests/unit/authz.test.ts
import { describe, it, expect } from "vitest";
import { hasRole, ROLES, type Role } from "@/lib/authz";

describe("hasRole", () => {
  it("exposes the four roles in rank order", () => {
    expect(ROLES).toEqual(["MEMBER", "MINISTRY_HEAD", "ADMIN", "SUPER_ADMIN"]);
  });

  it("same role passes", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("higher role passes lower requirement", () => {
    expect(hasRole("SUPER_ADMIN", "MEMBER")).toBe(true);
    expect(hasRole("ADMIN", "MINISTRY_HEAD")).toBe(true);
  });

  it("lower role fails higher requirement", () => {
    expect(hasRole("MEMBER", "MINISTRY_HEAD")).toBe(false);
    expect(hasRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("unknown role fails everything", () => {
    expect(hasRole("staff" as Role, "MEMBER")).toBe(false);
    expect(hasRole(undefined as unknown as Role, "MEMBER")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/authz.test.ts`
Expected: FAIL — cannot resolve `@/lib/authz`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/authz.ts`:

```ts
// app/src/lib/authz.ts
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const ROLES = ["MEMBER", "MINISTRY_HEAD", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** True when `actual` is at least as privileged as `required`. */
export function hasRole(actual: Role, required: Role): boolean {
  const a = ROLES.indexOf(actual);
  const r = ROLES.indexOf(required);
  return a >= 0 && r >= 0 && a >= r;
}

/**
 * Server-side guard for pages and actions. Redirects when the session
 * is missing or under-privileged. Returns the session for convenience.
 */
export async function requireRole(required: Role) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) redirect("/login");
  if (!role || !hasRole(role, required)) redirect("/me");
  return session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/authz.test.ts`
Expected: 5 tests PASS. (`requireRole` imports `auth` — vitest only loads it if the test touches it; tests only import `hasRole`/`ROLES`. If the import chain errors in vitest, split: keep `hasRole`/`ROLES` in `authz.ts` and move `requireRole` to `app/src/lib/authz-server.ts` with the same code.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/authz.ts tests/unit/authz.test.ts
git commit -m "feat(authz): role hierarchy + requireRole guard"
```

---

### Task 4: Journey ladder + priority helpers (pure)

**Files:**
- Create: `app/src/lib/journey.ts`
- Test: `app/tests/unit/journey.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/journey.test.ts`:

```ts
// app/tests/unit/journey.test.ts
import { describe, it, expect } from "vitest";
import {
  nextStage,
  isHeadEligible,
  nextFreePriority,
  type StageRow,
} from "@/lib/journey";

const LADDER: StageRow[] = [
  { stageCode: "FTV", name: "First Time Visitor", orderIndex: 10, isTerminal: false },
  { stageCode: "OGV", name: "Ongoing Visitor", orderIndex: 20, isTerminal: false },
  { stageCode: "RA", name: "Regular Attendee", orderIndex: 30, isTerminal: false },
  { stageCode: "REGULAR_MEMBER", name: "Regular Member", orderIndex: 40, isTerminal: false },
  { stageCode: "JOSHUA_GENERATION", name: "Joshua Generation", orderIndex: 50, isTerminal: false },
  { stageCode: "INNER_CORE", name: "Inner Core", orderIndex: 60, isTerminal: false },
  { stageCode: "DFL", name: "Drop From List", orderIndex: 99, isTerminal: true },
];

describe("nextStage", () => {
  it("returns the next non-terminal stage", () => {
    expect(nextStage(LADDER, "REGULAR_MEMBER")?.stageCode).toBe("JOSHUA_GENERATION");
    expect(nextStage(LADDER, "JOSHUA_GENERATION")?.stageCode).toBe("INNER_CORE");
  });

  it("returns null at the top of the ladder", () => {
    expect(nextStage(LADDER, "INNER_CORE")).toBeNull();
  });

  it("returns null for terminal or unknown stages", () => {
    expect(nextStage(LADDER, "DFL")).toBeNull();
    expect(nextStage(LADDER, "NOPE")).toBeNull();
  });
});

describe("isHeadEligible", () => {
  it("Inner Core and Joshua Generation are eligible", () => {
    expect(isHeadEligible("INNER_CORE")).toBe(true);
    expect(isHeadEligible("JOSHUA_GENERATION")).toBe(true);
  });

  it("everyone else is not", () => {
    expect(isHeadEligible("REGULAR_MEMBER")).toBe(false);
    expect(isHeadEligible("FTV")).toBe(false);
  });
});

describe("nextFreePriority", () => {
  it("returns 1 when nothing is taken", () => {
    expect(nextFreePriority([])).toBe(1);
  });

  it("returns the lowest free rank", () => {
    expect(nextFreePriority([1, 2])).toBe(3);
    expect(nextFreePriority([2, 3])).toBe(1);
    expect(nextFreePriority([1, 3])).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/journey.test.ts`
Expected: FAIL — cannot resolve `@/lib/journey`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/journey.ts`:

```ts
// app/src/lib/journey.ts
// Pure helpers for the christian-journey stage ladder and ministry priorities.

export interface StageRow {
  stageCode: string;
  name: string;
  orderIndex: number;
  isTerminal: boolean;
}

const HEAD_ELIGIBLE_STAGES = new Set(["INNER_CORE", "JOSHUA_GENERATION"]);

/** Next non-terminal stage above the current one, or null at the top. */
export function nextStage(
  ladder: StageRow[],
  currentStageCode: string
): StageRow | null {
  const current = ladder.find((s) => s.stageCode === currentStageCode);
  if (!current || current.isTerminal) return null;
  const above = ladder
    .filter((s) => !s.isTerminal && s.orderIndex > current.orderIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return above[0] ?? null;
}

/** Only Inner Core / Joshua Generation members may be appointed ministry head. */
export function isHeadEligible(stageCode: string): boolean {
  return HEAD_ELIGIBLE_STAGES.has(stageCode);
}

/** Lowest positive rank not present in `taken`. */
export function nextFreePriority(taken: number[]): number {
  const set = new Set(taken);
  let p = 1;
  while (set.has(p)) p++;
  return p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/journey.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey.ts tests/unit/journey.test.ts
git commit -m "feat(journey): stage ladder, head eligibility, priority helpers"
```

---

### Task 5: Signup + join-request validation schemas

**Files:**
- Create: `app/src/lib/validations/account.ts`
- Test: `app/tests/unit/account.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/account.test.ts`:

```ts
// app/tests/unit/account.test.ts
import { describe, it, expect } from "vitest";
import { signupSchema, joinRequestSchema } from "@/lib/validations/account";

const validSignup = {
  firstName: "Maria",
  lastName: "Santos",
  email: "maria@example.com",
  password: "s3cretpass",
  chapterId: 5,
};

describe("signupSchema", () => {
  it("accepts valid signup", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("accepts signup without chapter (no heads exist yet)", () => {
    const { chapterId: _omit, ...rest } = validSignup;
    expect(signupSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects short password", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, password: "short" }).success
    ).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, email: "nope" }).success
    ).toBe(false);
  });

  it("rejects empty names", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, firstName: "" }).success
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...validSignup, lastName: "" }).success
    ).toBe(false);
  });
});

describe("joinRequestSchema", () => {
  it("accepts valid request", () => {
    expect(
      joinRequestSchema.safeParse({ chapterId: 3, priority: 2 }).success
    ).toBe(true);
  });

  it("rejects priority below 1", () => {
    expect(
      joinRequestSchema.safeParse({ chapterId: 3, priority: 0 }).success
    ).toBe(false);
  });

  it("rejects missing chapter", () => {
    expect(joinRequestSchema.safeParse({ priority: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/account.test.ts`
Expected: FAIL — cannot resolve `@/lib/validations/account`

- [ ] **Step 3: Write implementation**

Create `app/src/lib/validations/account.ts`:

```ts
// app/src/lib/validations/account.ts
import { z } from "zod";

export const signupSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Optional: when no active ministry heads exist the picker is hidden.
  chapterId: z.number().int().positive().optional(),
});

export const joinRequestSchema = z.object({
  chapterId: z.number().int().positive("Ministry required"),
  priority: z.number().int().min(1, "Priority must be 1 or higher"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/account.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/account.ts tests/unit/account.test.ts
git commit -m "feat(account): signup + join-request validation schemas"
```

---

### Task 6: Member-profile provisioning helper

**Files:**
- Create: `app/src/lib/provision.ts`

Thin DB layer (no unit test — no DB mocking in this codebase; covered by E2E).

- [ ] **Step 1: Create provisioning helper**

Create `app/src/lib/provision.ts`:

```ts
// app/src/lib/provision.ts
// Ensures a login account is linked to a person + member profile.
// Used by self-signup and Google auto-creation. Every user gets a
// member profile (spec: universal profiles), stage REGULAR_MEMBER.
import { db } from "@/lib/db";
import { person, contactInfo, branch } from "@/schema/core";
import { member } from "@/schema/membership";
import { users } from "@/schema/app";
import { asc, eq, and, isNull } from "drizzle-orm";

export interface ProvisionResult {
  personId: number;
  memberId: number;
}

/**
 * Find-or-create the person + member profile for an email, and link it
 * to the given user row. Idempotent.
 */
export async function provisionMemberProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<ProvisionResult> {
  // 1. Person: match by EMAIL contact_info, else create.
  let personId: number;
  const [existingContact] = await db
    .select({ personId: contactInfo.personId })
    .from(contactInfo)
    .innerJoin(person, eq(contactInfo.personId, person.personId))
    .where(
      and(
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.value, email),
        isNull(person.deletedAt)
      )
    )
    .limit(1);

  if (existingContact) {
    personId = existingContact.personId;
  } else {
    const [newPerson] = await db
      .insert(person)
      .values({ firstName, lastName })
      .returning({ personId: person.personId });
    personId = newPerson.personId;
    await db.insert(contactInfo).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: personId as any,
      type: "EMAIL",
      value: email,
      isPrimary: true,
    });
  }

  // 2. Member: find by person, else create at REGULAR_MEMBER on the main branch.
  let memberId: number;
  const [existingMember] = await db
    .select({ memberId: member.memberId })
    .from(member)
    .where(eq(member.personId, personId))
    .limit(1);

  if (existingMember) {
    memberId = existingMember.memberId;
  } else {
    const [mainBranch] = await db
      .select({ branchId: branch.branchId })
      .from(branch)
      .orderBy(asc(branch.branchId))
      .limit(1);
    if (!mainBranch) throw new Error("No branch exists — seed branches first");
    const [newMember] = await db
      .insert(member)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personId: personId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchId: mainBranch.branchId as any,
        memberCode: `M-${personId}`,
        currentStage: "REGULAR_MEMBER",
        joinedAt: new Date(),
      })
      .returning({ memberId: member.memberId });
    memberId = newMember.memberId;
  }

  // 3. Link user → person.
  await db
    .update(users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ personId: personId as any })
    .where(eq(users.userId, userId));

  return { personId, memberId };
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/provision.ts
git commit -m "feat(account): member-profile provisioning helper"
```

---

### Task 7: Auth — role/personId in session, Google auto-create, isActive

**Files:**
- Create: `app/src/types/next-auth.d.ts`
- Modify: `app/src/lib/auth.ts`

- [ ] **Step 1: Session type augmentation**

Create `app/src/types/next-auth.d.ts`:

```ts
// app/src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
      personId?: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    personId?: number | null;
  }
}
```

- [ ] **Step 2: Rewrite `app/src/lib/auth.ts`**

Replace full contents:

```ts
// app/src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { provisionMemberProfile } from "@/lib/provision";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

providers.push(
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, credentials.email as string))
        .limit(1);

      if (!user || !user.passwordHash || !user.isActive) return null;

      const valid = await bcrypt.compare(
        credentials.password as string,
        user.passwordHash
      );
      if (!valid) return null;

      return { id: user.userId, email: user.email, name: user.name };
    },
  })
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email!;
        const [existing] = await db
          .select({ userId: users.userId, isActive: users.isActive })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (existing) return existing.isActive;

        // Unknown Google account → auto-create a MEMBER with a profile.
        const fullName = user.name ?? email;
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts.slice(0, -1).join(" ") || parts[0];
        const lastName = parts.length > 1 ? parts[parts.length - 1] : "—";
        const [created] = await db
          .insert(users)
          .values({ email, name: fullName, role: "MEMBER" })
          .returning({ userId: users.userId });
        await provisionMemberProfile(created.userId, email, firstName, lastName);
        return true;
      }
      return true;
    },
    async jwt({ token }) {
      // Refresh role/personId from DB on every token rotation so role
      // changes apply without re-login lag beyond token refresh.
      if (token.email) {
        const [u] = await db
          .select({
            role: users.role,
            personId: users.personId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, token.email))
          .limit(1);
        if (u) {
          token.role = u.role;
          token.personId = u.personId;
          if (!u.isActive) token.role = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.personId = token.personId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
```

- [ ] **Step 3: Verify compile + existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no TS errors; all unit tests pass

- [ ] **Step 4: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat(auth): role + personId in session, Google auto-create MEMBER, isActive gate"
```

---

### Task 8: Signup action + page, login redirect by role

**Files:**
- Create: `app/src/actions/account.ts`
- Create: `app/src/app/signup/page.tsx`
- Modify: `app/src/app/login/page.tsx` (add "Create an account" link near the form's submit button)

- [ ] **Step 1: Create account actions**

Create `app/src/actions/account.ts`:

```ts
// app/src/actions/account.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import { signupSchema } from "@/lib/validations/account";
import { provisionMemberProfile } from "@/lib/provision";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

/** Active ministry heads for the signup picker / re-request picker. */
export async function listActiveHeads() {
  return db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryName: ministry.name,
      headFirstName: person.firstName,
      headLastName: person.lastName,
    })
    .from(ministryMembership)
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(
      and(
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt),
        eq(ministryChapter.status, "ACTIVE")
      )
    )
    .orderBy(ministry.name);
}

export async function signup(formData: FormData) {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: (formData.get("email") as string | null)?.toLowerCase().trim(),
    password: formData.get("password"),
    chapterId: formData.get("chapterId")
      ? Number(formData.get("chapterId"))
      : undefined,
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const [existing] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.email, d.email))
    .limit(1);
  if (existing) {
    return { errors: { email: ["An account with this email already exists"] } };
  }

  const passwordHash = await bcrypt.hash(d.password, 10);
  const [created] = await db
    .insert(users)
    .values({
      email: d.email,
      name: `${d.firstName} ${d.lastName}`,
      passwordHash,
      role: "MEMBER",
    })
    .returning({ userId: users.userId });

  const { memberId } = await provisionMemberProfile(
    created.userId,
    d.email,
    d.firstName,
    d.lastName
  );

  // Priority-1 join request to the chosen head's chapter.
  if (d.chapterId) {
    await db.insert(joinRequest).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: memberId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapterId: d.chapterId as any,
      priority: 1,
    });
  }

  redirect("/login?registered=1");
}
```

- [ ] **Step 2: Create signup page**

Create `app/src/app/signup/page.tsx`:

```tsx
// app/src/app/signup/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { signup, listActiveHeads } from "@/actions/account";

export default async function SignupPage() {
  const heads = await listActiveHeads();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Join JLY Church and start your journey.
          </p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form action={signup as any} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                name="firstName"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                name="lastName"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
          </div>

          {heads.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your ministry head <span className="text-red-500">*</span>
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose your ministry head…</option>
                {heads.map((h) => (
                  <option key={h.chapterId} value={h.chapterId}>
                    {h.headFirstName} {h.headLastName} — {h.ministryName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Your head will approve your request (this becomes your 1st-priority
                ministry).
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign up
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add signup link + role redirect on login page**

In `app/src/app/login/page.tsx`:
1. Below the login form's submit button (inside the form card), add:

```tsx
<p className="text-sm text-gray-500 text-center mt-4">
  New here?{" "}
  <Link href="/signup" className="text-blue-600 hover:text-blue-800">
    Create an account
  </Link>
</p>
```

(Add `import Link from "next/link";` if the file doesn't already import it.)

2. Find where the login form sets the post-login destination (a `redirectTo`/`callbackUrl` value or a hardcoded `/members`). The destination must become role-aware. The cleanest hook with NextAuth credentials sign-in is a tiny server redirect page: keep login redirecting to `/members` BUT add a role fallthrough in middleware (Task 9 sends MEMBER/MINISTRY_HEAD users who hit `/members` to `/me` / `/ministry`). No login-page logic change is required beyond the signup link — note this in the code review.

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/actions/account.ts src/app/signup/page.tsx src/app/login/page.tsx
git commit -m "feat(account): self-signup with ministry-head request, signup page"
```

---

### Task 9: Middleware role guards

**Files:**
- Modify: `app/middleware.ts`

- [ ] **Step 1: Rewrite middleware**

Replace full contents of `app/middleware.ts`:

```ts
// app/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_PREFIXES = [
  "/members",
  "/events",
  "/programs",
  "/education",
  "/ministries",
  "/missions",
  "/announcements",
  "/attendance",
  "/bac",
  "/ghl",
];

const ROLE_RANK: Record<string, number> = {
  MEMBER: 0,
  MINISTRY_HEAD: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function rank(role: string | undefined): number {
  return role !== undefined && role in ROLE_RANK ? ROLE_RANK[role] : -1;
}

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const session = req.auth;
  const role = session?.user?.role;

  const isAdminRoute = ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/")
  );
  const isUsersRoute = path === "/users" || path.startsWith("/users/");
  const isMinistryRoute = path === "/ministry" || path.startsWith("/ministry/");
  const isMeRoute = path === "/me" || path.startsWith("/me/");

  if (!(isAdminRoute || isUsersRoute || isMinistryRoute || isMeRoute)) return;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isUsersRoute && rank(role) < ROLE_RANK.SUPER_ADMIN) {
    return NextResponse.redirect(new URL("/me", req.url));
  }
  if (isAdminRoute && rank(role) < ROLE_RANK.ADMIN) {
    // Logged-in members/heads land on their own dashboards.
    const dest = rank(role) >= ROLE_RANK.MINISTRY_HEAD ? "/ministry" : "/me";
    return NextResponse.redirect(new URL(dest, req.url));
  }
  if (isMinistryRoute && rank(role) < ROLE_RANK.MINISTRY_HEAD) {
    return NextResponse.redirect(new URL("/me", req.url));
  }
});

export const config = {
  matcher: [
    "/members/:path*",
    "/events/:path*",
    "/programs/:path*",
    "/education/:path*",
    "/ministries/:path*",
    "/missions/:path*",
    "/announcements/:path*",
    "/attendance/:path*",
    "/bac/:path*",
    "/ghl/:path*",
    "/users/:path*",
    "/ministry/:path*",
    "/me/:path*",
  ],
};
```

Note: matcher entries like `"/me/:path*"` also match `/me` itself in Next 14; if manual testing shows `/me` unguarded, add bare entries (`"/me"`, `"/ministry"`, `"/users"`) to the matcher array.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(authz): role-aware middleware guards for admin/ministry/me/users routes"
```

---

### Task 10: Join-request server actions

**Files:**
- Create: `app/src/actions/join-requests.ts`

- [ ] **Step 1: Create actions**

Create `app/src/actions/join-requests.ts`:

```ts
// app/src/actions/join-requests.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
} from "@/schema/ministries";
import { joinRequestSchema } from "@/lib/validations/account";
import { requireRole } from "@/lib/authz";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Resolve the signed-in user's memberId (null when not provisioned). */
async function currentMemberId(): Promise<number | null> {
  const session = await requireRole("MEMBER");
  const email = session.user?.email;
  if (!email) return null;
  const [row] = await db
    .select({ memberId: member.memberId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);
  return row?.memberId ?? null;
}

/** Priority ranks already taken by active memberships + pending requests. */
async function takenPriorities(memberId: number): Promise<number[]> {
  const memberships = await db
    .select({ priority: ministryMembership.priority })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        isNull(ministryMembership.endedAt)
      )
    );
  const pending = await db
    .select({ priority: joinRequest.priority })
    .from(joinRequest)
    .where(
      and(eq(joinRequest.memberId, memberId), eq(joinRequest.status, "PENDING"))
    );
  return [...memberships, ...pending]
    .map((r) => r.priority)
    .filter((p): p is number => p != null);
}

export async function requestJoin(formData: FormData) {
  const memberId = await currentMemberId();
  if (!memberId) return { errors: { chapterId: ["Profile not linked"] } };

  const parsed = joinRequestSchema.safeParse({
    chapterId: Number(formData.get("chapterId")),
    priority: Number(formData.get("priority")),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { chapterId, priority } = parsed.data;

  const taken = await takenPriorities(memberId);
  if (taken.includes(priority)) {
    return {
      errors: { priority: [`Priority ${priority} is already taken`] },
    };
  }

  // Already an active member of this chapter?
  const [already] = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, memberId),
        eq(ministryMembership.chapterId, chapterId),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  if (already) {
    return { errors: { chapterId: ["You already belong to this ministry"] } };
  }

  await db.insert(joinRequest).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memberId: memberId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chapterId: chapterId as any,
    priority,
  });

  revalidatePath("/me");
  revalidatePath("/ministry");
  return { ok: true };
}

/** ChapterIds the signed-in head leads (active HEAD memberships). */
export async function headChapterIds(): Promise<number[]> {
  const session = await requireRole("MINISTRY_HEAD");
  const email = session.user?.email;
  if (!email) return [];
  const rows = await db
    .select({ chapterId: ministryMembership.chapterId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(
      ministryMembership,
      eq(ministryMembership.memberId, member.memberId)
    )
    .where(
      and(
        eq(users.email, email),
        eq(ministryMembership.isLeader, true),
        eq(ministryMembership.leaderRole, "HEAD"),
        isNull(ministryMembership.endedAt)
      )
    );
  return rows.map((r) => r.chapterId);
}

async function loadOwnedPendingRequest(requestId: number) {
  const chapters = await headChapterIds();
  if (chapters.length === 0) return null;
  const [req] = await db
    .select()
    .from(joinRequest)
    .where(
      and(
        eq(joinRequest.requestId, requestId),
        eq(joinRequest.status, "PENDING"),
        inArray(joinRequest.chapterId, chapters)
      )
    )
    .limit(1);
  return req ?? null;
}

export async function approveJoinRequest(requestId: number) {
  const req = await loadOwnedPendingRequest(requestId);
  if (!req) return { errors: { request: ["Request not found"] } };

  // Idempotent: skip duplicate membership.
  const [already] = await db
    .select({ membershipId: ministryMembership.membershipId })
    .from(ministryMembership)
    .where(
      and(
        eq(ministryMembership.memberId, req.memberId),
        eq(ministryMembership.chapterId, req.chapterId),
        isNull(ministryMembership.endedAt)
      )
    )
    .limit(1);
  if (!already) {
    await db.insert(ministryMembership).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapterId: req.chapterId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memberId: req.memberId as any,
      joinedAt: new Date(),
      priority: req.priority,
    });
  }

  await db
    .update(joinRequest)
    .set({ status: "APPROVED", decidedAt: new Date() })
    .where(eq(joinRequest.requestId, requestId));

  revalidatePath("/ministry");
  revalidatePath("/me");
  return { ok: true };
}

export async function rejectJoinRequest(requestId: number) {
  const req = await loadOwnedPendingRequest(requestId);
  if (!req) return { errors: { request: ["Request not found"] } };

  await db
    .update(joinRequest)
    .set({ status: "REJECTED", decidedAt: new Date() })
    .where(eq(joinRequest.requestId, requestId));

  revalidatePath("/ministry");
  revalidatePath("/me");
  return { ok: true };
}

/** Joinable chapters (active, with names) for the /me picker. */
export async function listJoinableChapters() {
  return db
    .select({
      chapterId: ministryChapter.chapterId,
      ministryId: ministryChapter.ministryId,
    })
    .from(ministryChapter)
    .where(eq(ministryChapter.status, "ACTIVE"));
}
```

(`listJoinableChapters` is a placeholder shape — Task 11 queries names directly in the page; remove this export there if unused.)

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/actions/join-requests.ts
git commit -m "feat(ministry): join-request actions — request, approve, reject with ownership checks"
```

---

### Task 11: `/me` member profile dashboard

**Files:**
- Create: `app/src/app/me/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/src/app/me/page.tsx`:

```tsx
// app/src/app/me/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import { person } from "@/schema/core";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { requireRole, hasRole, type Role } from "@/lib/authz";
import { nextStage, nextFreePriority, type StageRow } from "@/lib/journey";
import { requestJoin } from "@/actions/join-requests";
import { listActiveHeads } from "@/actions/account";
import { and, asc, eq, isNull } from "drizzle-orm";

export default async function MePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;
  const role = (session.user!.role ?? "MEMBER") as Role;

  const [me] = await db
    .select({
      memberId: member.memberId,
      currentStage: member.currentStage,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.email, email))
    .limit(1);

  const ladder: StageRow[] = await db
    .select({
      stageCode: lifecycleStage.stageCode,
      name: lifecycleStage.name,
      orderIndex: lifecycleStage.orderIndex,
      isTerminal: lifecycleStage.isTerminal,
    })
    .from(lifecycleStage)
    .where(eq(lifecycleStage.isActive, true))
    .orderBy(asc(lifecycleStage.orderIndex));

  const visibleLadder = ladder.filter((s) => !s.isTerminal);

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">My profile</h1>
        <p className="mt-4 text-gray-600">
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

  const memberships = await db
    .select({
      priority: ministryMembership.priority,
      ministryName: ministry.name,
      chapterId: ministryChapter.chapterId,
    })
    .from(ministryMembership)
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        eq(ministryMembership.memberId, me.memberId),
        isNull(ministryMembership.endedAt)
      )
    );

  const requests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      status: joinRequest.status,
      ministryName: ministry.name,
    })
    .from(joinRequest)
    .innerJoin(
      ministryChapter,
      eq(joinRequest.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(joinRequest.memberId, me.memberId))
    .orderBy(asc(joinRequest.priority));

  const heads = await listActiveHeads();
  const memberChapterIds = new Set(memberships.map((m) => m.chapterId));
  const pendingChapterCount = requests.filter((r) => r.status === "PENDING").length;
  const taken = [
    ...memberships.map((m) => m.priority),
    ...requests.filter((r) => r.status === "PENDING").map((r) => r.priority),
  ].filter((p): p is number => p != null);
  const suggestedPriority = nextFreePriority(taken);
  const next = nextStage(ladder, me.currentStage);
  const currentStageRow = ladder.find((s) => s.stageCode === me.currentStage);

  const sortedMemberships = [...memberships].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {me.firstName} {me.lastName}
          </h1>
          <p className="text-sm text-gray-500">My christian journey</p>
        </div>
        <div className="flex gap-3 text-sm">
          {hasRole(role, "MINISTRY_HEAD") && (
            <Link href="/ministry" className="text-blue-600 hover:text-blue-800">
              Ministry dashboard
            </Link>
          )}
          {hasRole(role, "ADMIN") && (
            <Link href="/members" className="text-blue-600 hover:text-blue-800">
              Admin
            </Link>
          )}
          <Link href="/church/calendar" className="text-blue-600 hover:text-blue-800">
            Calendar
          </Link>
        </div>
      </div>

      {/* Journey ladder */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Journey</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {visibleLadder.map((s, i) => {
            const isCurrent = s.stageCode === me.currentStage;
            const passed =
              currentStageRow !== undefined &&
              s.orderIndex < currentStageRow.orderIndex;
            return (
              <li key={s.stageCode} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : passed
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s.name}
                </span>
              </li>
            );
          })}
        </ol>
        {next ? (
          <p className="text-sm text-gray-600">
            Next step: <span className="font-medium text-gray-900">{next.name}</span>
            {next.name && next.stageCode !== me.currentStage && (
              <> — {ladder.find((s) => s.stageCode === next.stageCode)?.name}</>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            You are at the top of the ladder. Keep leading!
          </p>
        )}
      </section>

      {/* My ministries */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">My ministries</h2>
        {sortedMemberships.length === 0 ? (
          <p className="text-sm text-gray-500">No ministries yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedMemberships.map((m) => (
              <li key={m.chapterId} className="flex items-center gap-3 py-2 text-sm">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  {m.priority ?? "—"}
                </span>
                <span className="text-gray-900">{m.ministryName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Join a ministry */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Join a ministry</h2>

        {requests.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {requests.map((r) => (
              <li
                key={r.requestId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-gray-900">
                  #{r.priority} — {r.ministryName}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "PENDING"
                      ? "bg-yellow-50 text-yellow-700"
                      : r.status === "APPROVED"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        {heads.filter((h) => !memberChapterIds.has(h.chapterId)).length === 0 ? (
          <p className="text-sm text-gray-500">
            No ministries available to join right now.
          </p>
        ) : (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          <form action={requestJoin as any} className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ministry
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {heads
                  .filter((h) => !memberChapterIds.has(h.chapterId))
                  .map((h) => (
                    <option key={h.chapterId} value={h.chapterId}>
                      {h.ministryName} — {h.headFirstName} {h.headLastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <input
                name="priority"
                type="number"
                min="1"
                defaultValue={suggestedPriority}
                required
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Request to join
            </button>
          </form>
        )}
        {pendingChapterCount > 0 && (
          <p className="text-xs text-gray-400">
            Requests are approved by the ministry head.
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/me/page.tsx
git commit -m "feat(me): member profile — journey ladder, my ministries, join requests"
```

---

### Task 12: `/ministry` head dashboard

**Files:**
- Create: `app/src/app/ministry/page.tsx`
- Create: `app/src/components/request-decision-buttons.tsx`

- [ ] **Step 1: Approve/Reject client buttons**

Create `app/src/components/request-decision-buttons.tsx`:

```tsx
// app/src/components/request-decision-buttons.tsx
"use client";

import { useTransition } from "react";
import { approveJoinRequest, rejectJoinRequest } from "@/actions/join-requests";

export default function RequestDecisionButtons({
  requestId,
}: {
  requestId: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => approveJoinRequest(requestId))}
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => rejectJoinRequest(requestId))}
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Head dashboard page**

Create `app/src/app/ministry/page.tsx`:

```tsx
// app/src/app/ministry/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person } from "@/schema/core";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { checkIn } from "@/schema/attendance";
import { requireRole } from "@/lib/authz";
import { headChapterIds } from "@/actions/join-requests";
import RequestDecisionButtons from "@/components/request-decision-buttons";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

const ordinal = (p: number | null) =>
  p == null ? "—" : p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : `${p}th`;

export default async function MinistryDashboardPage() {
  await requireRole("MINISTRY_HEAD");
  const chapters = await headChapterIds();

  if (chapters.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">My ministry</h1>
        <p className="mt-4 text-gray-600">
          You are not assigned as head of any chapter yet.
        </p>
      </div>
    );
  }

  const pendingRequests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      requestedAt: joinRequest.requestedAt,
      ministryName: ministry.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
    })
    .from(joinRequest)
    .innerJoin(member, eq(joinRequest.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(
      ministryChapter,
      eq(joinRequest.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        inArray(joinRequest.chapterId, chapters),
        eq(joinRequest.status, "PENDING")
      )
    )
    .orderBy(asc(joinRequest.requestedAt));

  const roster = await db
    .select({
      membershipId: ministryMembership.membershipId,
      chapterId: ministryMembership.chapterId,
      priority: ministryMembership.priority,
      ministryName: ministry.name,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      lastCheckIn: sql<Date | null>`(
        select max(ci.checked_in_at) from attendance.check_in ci
        where ci.person_id = ${member.personId}
      )`,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(
      ministryChapter,
      eq(ministryMembership.chapterId, ministryChapter.chapterId)
    )
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(
      and(
        inArray(ministryMembership.chapterId, chapters),
        isNull(ministryMembership.endedAt)
      )
    )
    .orderBy(asc(ministry.name), desc(ministryMembership.isLeader));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My ministry</h1>
        <Link href="/me" className="text-sm text-blue-600 hover:text-blue-800">
          My profile
        </Link>
      </div>

      {/* Pending requests */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Join requests{" "}
          {pendingRequests.length > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {pendingRequests.length}
            </span>
          )}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Ministry</th>
                <th className="py-2 pr-4 font-medium">Their priority</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r) => (
                <tr key={r.requestId} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{r.currentStage}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.ministryName}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {ordinal(r.priority)} priority
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <RequestDecisionButtons requestId={r.requestId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Roster / monitoring */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">My members</h2>
        {roster.length === 0 ? (
          <p className="text-sm text-gray-500">No members yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Ministry</th>
                <th className="py-2 pr-4 font-medium">Priority</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 font-medium">Last attendance</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.membershipId} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{m.ministryName}</td>
                  <td className="py-2 pr-4 text-gray-600">{ordinal(m.priority)}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.currentStage}</td>
                  <td className="py-2 text-gray-600">
                    {m.lastCheckIn
                      ? new Date(m.lastCheckIn).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          dateStyle: "medium",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

Note: `checkIn` import is only referenced through raw SQL — if `next lint` flags it unused, remove the import (the raw SQL references the table name directly).

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors (remove unused `checkIn`/`desc` imports if flagged)

- [ ] **Step 4: Commit**

```bash
git add src/app/ministry/page.tsx src/components/request-decision-buttons.tsx
git commit -m "feat(ministry): head dashboard — requests with priority badges, roster monitoring"
```

---

### Task 13: `/users` super-admin management

**Files:**
- Create: `app/src/actions/users.ts`
- Create: `app/src/app/users/page.tsx`
- Create: `app/src/components/user-role-controls.tsx`

- [ ] **Step 1: User management actions**

Create `app/src/actions/users.ts`:

```ts
// app/src/actions/users.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole, ROLES, type Role } from "@/lib/authz";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { provisionMemberProfile } from "@/lib/provision";

export async function changeUserRole(userId: string, role: string) {
  const session = await requireRole("SUPER_ADMIN");
  if (!ROLES.includes(role as Role)) {
    return { errors: { role: ["Invalid role"] } };
  }
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { role: ["User not found"] } };
  if (target.email === session.user?.email) {
    return { errors: { role: ["You cannot change your own role"] } };
  }
  await db.update(users).set({ role }).where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { active: ["User not found"] } };
  if (target.email === session.user?.email) {
    return { errors: { active: ["You cannot deactivate yourself"] } };
  }
  await db.update(users).set({ isActive }).where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

/** Provision (or re-link) the member profile for a legacy user. */
export async function provisionUserProfile(userId: string) {
  await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { user: ["User not found"] } };
  const fullName = target.name ?? target.email;
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.slice(0, -1).join(" ") || parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "—";
  await provisionMemberProfile(userId, target.email, firstName, lastName);
  revalidatePath("/users");
  return { ok: true };
}
```

- [ ] **Step 2: Role controls client component**

Create `app/src/components/user-role-controls.tsx`:

```tsx
// app/src/components/user-role-controls.tsx
"use client";

import { useTransition } from "react";
import {
  changeUserRole,
  setUserActive,
  provisionUserProfile,
} from "@/actions/users";

const ROLE_OPTIONS = ["MEMBER", "MINISTRY_HEAD", "ADMIN", "SUPER_ADMIN"];

export default function UserRoleControls({
  userId,
  role,
  isActive,
  hasProfile,
  isSelf,
}: {
  userId: string;
  role: string;
  isActive: boolean;
  hasProfile: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return <span className="text-xs text-gray-400">you</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => changeUserRole(userId, e.target.value))
        }
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {!hasProfile && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => provisionUserProfile(userId))}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Provision profile
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => setUserActive(userId, !isActive))}
        className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 ${
          isActive
            ? "border border-red-300 text-red-600 hover:bg-red-50"
            : "border border-green-300 text-green-700 hover:bg-green-50"
        }`}
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Users page**

Create `app/src/app/users/page.tsx`:

```tsx
// app/src/app/users/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz";
import { asc } from "drizzle-orm";
import UserRoleControls from "@/components/user-role-controls";

export default async function UsersPage() {
  const session = await requireRole("SUPER_ADMIN");

  const rows = await db
    .select({
      userId: users.userId,
      email: users.email,
      name: users.name,
      role: users.role,
      personId: users.personId,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Link href="/me" className="text-sm text-blue-600 hover:text-blue-800">
          My profile
        </Link>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.userId} className="border-b border-gray-100">
              <td className="py-2 pr-4 text-gray-900">{u.email}</td>
              <td className="py-2 pr-4 text-gray-600">{u.name ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-600">{u.role}</td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {u.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </td>
              <td className="py-2">
                <UserRoleControls
                  userId={u.userId}
                  role={u.role}
                  isActive={u.isActive}
                  hasProfile={u.personId != null}
                  isSelf={u.email === session.user?.email}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verify compile + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/actions/users.ts src/app/users/page.tsx src/components/user-role-controls.tsx
git commit -m "feat(users): super-admin user management — roles, activation, profile provisioning"
```

---

### Task 14: Head assignment eligibility + account promotion

**Files:**
- Modify: `app/src/actions/ministries.ts` (extend `setLeaderRole`)
- Modify: `app/src/app/(admin)/ministries/[id]/chapters/[cid]/page.tsx` (eligibility hint only if UI lists leader options)

- [ ] **Step 1: Extend `setLeaderRole` in `app/src/actions/ministries.ts`**

Open `app/src/actions/ministries.ts`, find `export async function setLeaderRole(...)`. Add these imports at the top of the file (merge with existing import lines):

```ts
import { users } from "@/schema/app";
import { isHeadEligible } from "@/lib/journey";
import { requireRole } from "@/lib/authz";
```

Then modify `setLeaderRole` so that BEFORE the existing update it: (a) requires ADMIN, (b) enforces stage eligibility when promoting to HEAD, and AFTER the update it syncs the linked account's role. The final function (keep its existing signature and the existing update statement in the middle):

```ts
export async function setLeaderRole(
  membershipId: number,
  isLeader: boolean,
  leaderRole?: string
) {
  await requireRole("ADMIN");
  if (isLeader && !leaderRole) {
    return { errors: { leaderRole: ["Leader role required"] } };
  }

  // Load the membership + member stage + linked account.
  const [row] = await db
    .select({
      memberId: ministryMembership.memberId,
      chapterId: ministryMembership.chapterId,
      currentStage: member.currentStage,
      personId: member.personId,
    })
    .from(ministryMembership)
    .innerJoin(member, eq(ministryMembership.memberId, member.memberId))
    .where(eq(ministryMembership.membershipId, membershipId))
    .limit(1);
  if (!row) return { errors: { leaderRole: ["Membership not found"] } };

  // Eligibility: only Inner Core / Joshua Generation can be HEAD.
  if (isLeader && leaderRole === "HEAD" && !isHeadEligible(row.currentStage)) {
    return {
      errors: {
        leaderRole: [
          "Only Inner Core or Joshua Generation members can be appointed ministry head",
        ],
      },
    };
  }

  // ── existing update statement stays exactly as-is here ──
  await db
    .update(ministryMembership)
    .set({
      isLeader,
      leaderRole: isLeader
        ? (leaderRole as "HEAD" | "ASSISTANT_HEAD" | "COORDINATOR")
        : null,
    })
    .where(eq(ministryMembership.membershipId, membershipId));
  // (keep whatever revalidatePath calls the function already has)

  // Sync linked account role.
  const [account] = await db
    .select({ userId: users.userId, role: users.role })
    .from(users)
    .where(eq(users.personId, row.personId))
    .limit(1);
  if (account) {
    if (isLeader && leaderRole === "HEAD" && account.role === "MEMBER") {
      await db
        .update(users)
        .set({ role: "MINISTRY_HEAD" })
        .where(eq(users.userId, account.userId));
    }
    if ((!isLeader || leaderRole !== "HEAD") && account.role === "MINISTRY_HEAD") {
      // Demote only when they lead no other chapter.
      const stillLeads = await db
        .select({ membershipId: ministryMembership.membershipId })
        .from(ministryMembership)
        .where(
          and(
            eq(ministryMembership.memberId, row.memberId),
            eq(ministryMembership.isLeader, true),
            eq(ministryMembership.leaderRole, "HEAD"),
            isNull(ministryMembership.endedAt)
          )
        )
        .limit(1);
      if (stillLeads.length === 0) {
        await db
          .update(users)
          .set({ role: "MEMBER" })
          .where(eq(users.userId, account.userId));
      }
    }
  }

  revalidatePath(`/ministries`);
  return { ok: true };
}
```

IMPORTANT: merge carefully with the existing function body — keep its existing return shape and any `revalidatePath` calls it already makes (look at the current implementation first; preserve its behavior for non-HEAD leader roles). Ensure `and` and `isNull` are imported from `drizzle-orm` in this file (they likely already are — check).

- [ ] **Step 2: Run existing ministries unit tests + compile**

Run: `npx tsc --noEmit && npx vitest run tests/unit/ministries.test.ts`
Expected: no errors, existing tests pass (they test Zod schemas, not this action)

- [ ] **Step 3: Commit**

```bash
git add src/actions/ministries.ts
git commit -m "feat(ministries): head eligibility (Inner Core/Joshua Gen) + account role sync"
```

---

### Task 15: E2E tests

**Files:**
- Create: `app/tests/e2e/roles-journey.spec.ts`

- [ ] **Step 1: Write E2E spec**

Create `app/tests/e2e/roles-journey.spec.ts`:

```ts
// app/tests/e2e/roles-journey.spec.ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@jly.church";
const ADMIN_PASSWORD = "changeme";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  waitFor: string | RegExp
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(waitFor);
}

test.describe("Signup and member profile", () => {
  test("new signup lands on /me with journey ladder", async ({ page }) => {
    const email = `e2e-member-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Member");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    // Head picker present only when a head exists; pick first option if shown.
    const picker = page.locator('select[name="chapterId"]');
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/login/);

    await login(page, email, "password123", "/me");
    await expect(page.getByText("Journey")).toBeVisible();
    await expect(page.getByText("Regular Member").first()).toBeVisible();
  });

  test("MEMBER is blocked from admin routes", async ({ page }) => {
    const email = `e2e-blocked-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Blocked");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    const picker = page.locator('select[name="chapterId"]');
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/login/);
    await login(page, email, "password123", "/me");

    await page.goto("/members");
    await page.waitForURL("/me");
  });
});

test.describe("Super admin user management", () => {
  test("admin (SUPER_ADMIN seed) can open /users and see roles", async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/members");
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test("admin sees own member profile at /me", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/members");
    await page.goto("/me");
    // Either the journey ladder (profile provisioned) or the not-linked notice.
    const journey = page.getByText("Journey");
    const notLinked = page.getByText("not linked");
    await expect(journey.or(notLinked)).toBeVisible();
  });
});
```

(Head approve/reject E2E requires seeding a head with a login — covered manually / in a follow-up seed; the request-creation path is exercised by the signup test when a head exists.)

- [ ] **Step 2: Run E2E (requires local DB + migrations applied)**

Run: `npx playwright test tests/e2e/roles-journey.spec.ts`
Expected: PASS (skip if no local DB this session; note in report)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/roles-journey.spec.ts
git commit -m "test(roles): e2e — signup, member profile, role guards, users page"
```

---

### Task 16: Final verification + docs

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all pass (245 pre-existing + ~21 new)

- [ ] **Step 2: Type check + lint + build**

Run: `npx tsc --noEmit && npx next lint && npm run build`
Expected: clean; new routes `/signup`, `/me`, `/ministry`, `/users` in build output

- [ ] **Step 3: Update CLAUDE.md**

In `JLYCC App/CLAUDE.md` under "Current Progress → Completed", add:

```
- **Plan 18 — Roles & Member Journey**: 4-role access (Super Admin/Admin/Ministry Head/Member), self-signup, universal member profiles (/me), FB-style ministry join requests with priority ranks, head dashboard (/ministry), super-admin user management (/users), head eligibility = Inner Core/Joshua Generation
```

Also update the stage list mention and migrations count (V001–V069).

- [ ] **Step 4: Commit**

```bash
git add ../CLAUDE.md
git commit -m "docs: record roles + member journey completion"
```

---

## Self-Review Notes

- Spec coverage: roles + CHECK (T1–2), hierarchy guard (T3, T9), stages extension (T1), head eligibility (T4, T14), signup + priority-1 request + provisioning (T5–T8), Google auto-create + isActive (T7), join requests multi-ministry with priorities (T10, T11), head approve/reject with priority visibility + roster monitoring incl. last attendance (T12), /users management + provisioning legacy accounts (T13), nav cross-links embedded in pages (T11–T13), E2E (T15).
- Known deferred: head approve/reject E2E needs a seeded head login; role redirect after login handled by middleware fallthrough rather than login-page logic.
- Type consistency: `Role`/`ROLES` from `lib/authz` used in T9 (middleware duplicates rank map deliberately — middleware cannot import `requireRole`'s redirect), `StageRow` from `lib/journey` used in T11.
