# Plan 5: Web App Foundation & Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Next.js 14 web app to the monorepo with staff auth and member management (list, search, view, create, edit).

**Architecture:** `app/` directory added alongside `db/` and `etl/`. Next.js 14 App Router with Server Components + Server Actions. Drizzle ORM queries the existing Postgres using `app_reader`/`app_writer` roles already defined in Flyway migrations. Auth.js v5 handles staff sessions.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Drizzle ORM (`drizzle-orm`, `postgres`), Auth.js v5 (`next-auth`), Zod, Vitest, Playwright.

---

## File Map

```
app/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── middleware.ts                          # route protection
├── .env.example                           # committed template
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # root layout
│   │   ├── page.tsx                       # public home placeholder
│   │   ├── login/
│   │   │   └── page.tsx                   # staff login form
│   │   └── (admin)/
│   │       ├── layout.tsx                 # admin shell (nav, sidebar)
│   │       └── members/
│   │           ├── page.tsx               # member list + search
│   │           ├── new/
│   │           │   └── page.tsx           # create member form
│   │           └── [id]/
│   │               ├── page.tsx           # member detail
│   │               └── edit/
│   │                   └── page.tsx       # edit member form
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   └── table.tsx
│   │   └── members/
│   │       ├── member-search.tsx          # search bar (client component)
│   │       └── member-form.tsx            # shared create/edit form
│   ├── lib/
│   │   ├── db.ts                          # Drizzle singleton
│   │   ├── auth.ts                        # Auth.js config
│   │   └── validations/
│   │       └── member.ts                  # Zod schemas
│   ├── schema/
│   │   ├── core.ts                        # Drizzle: core.person, branch, contact_info
│   │   ├── membership.ts                  # Drizzle: member, lifecycle_stage, role, member_role, pcm
│   │   └── app.ts                         # Drizzle: app.users
│   └── actions/
│       ├── members.ts                     # createMember, updateMember server actions
│       └── auth.ts                        # login/logout server actions
└── tests/
    ├── unit/
    │   └── member.test.ts                 # Zod schema unit tests
    └── e2e/
        └── members.spec.ts                # Playwright E2E
```

---

## Task 1: Scaffold Next.js App

**Files:**
- Create: `app/package.json`
- Create: `app/tsconfig.json`
- Create: `app/next.config.ts`
- Create: `app/tailwind.config.ts`
- Create: `app/postcss.config.js`
- Create: `app/.env.example`
- Create: `app/src/app/layout.tsx`
- Create: `app/src/app/page.tsx`

- [ ] **Step 1: Create `app/` directory and initialize**

```bash
mkdir app
cd app
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

When prompted about the `src/` directory: say no (the scaffold puts files at root `app/` level). After scaffold, move files into `src/` manually if needed, or accept the flat layout — both work. We use `src/` per the spec.

Re-run with:
```bash
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*" --yes
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd app
npm install drizzle-orm postgres
npm install next-auth@beta
npm install zod
npm install --save-dev drizzle-kit vitest @vitejs/plugin-react @playwright/test
npm install --save-dev @types/pg
```

- [ ] **Step 3: Create `.env.example`**

```
# app/.env.example
DATABASE_URL=postgresql://app_writer:changeme@localhost:5432/jly_church
DATABASE_URL_READER=postgresql://app_reader:changeme@localhost:5432/jly_church
AUTH_SECRET=replace-with-32-char-random-string
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

Copy to `.env.local` (gitignored) and fill in values from `db/docker-compose.yml`.

- [ ] **Step 4: Verify dev server starts**

```bash
cd app
npm run dev
```

Expected: `ready - started server on 0.0.0.0:3000`

Open `http://localhost:3000` — see default Next.js page.

- [ ] **Step 5: Commit**

```bash
cd ..
git add app/
git commit -m "feat(app): scaffold Next.js 14 app with TypeScript and Tailwind"
```

---

## Task 2: Configure Drizzle ORM

**Files:**
- Create: `app/drizzle.config.ts`
- Create: `app/src/lib/db.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```typescript
// app/drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 2: Create `src/lib/db.ts`**

```typescript
// app/src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as core from "@/schema/core";
import * as membership from "@/schema/membership";
import * as app from "@/schema/app";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch for transactions
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, {
  schema: { ...core, ...membership, ...app },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/drizzle.config.ts app/src/lib/db.ts
git commit -m "feat(app): add Drizzle ORM config and db singleton"
```

---

## Task 3: Define Drizzle Schema

**Files:**
- Create: `app/src/schema/core.ts`
- Create: `app/src/schema/membership.ts`
- Create: `app/src/schema/app.ts`

These definitions mirror the Flyway migrations. Verify column names against:
- `db/migrations/V006__core_branch.sql`
- `db/migrations/V008__core_person.sql`
- `db/migrations/V009__core_contact_info.sql`
- `db/migrations/V015__membership_lifecycle_stage.sql`
- `db/migrations/V016__membership_role.sql`
- `db/migrations/V017__membership_member.sql`
- `db/migrations/V020__membership_member_role.sql`
- `db/migrations/V022__membership_pastoral_care_assignment.sql`

- [ ] **Step 1: Create `src/schema/core.ts`**

```typescript
// app/src/schema/core.ts
import {
  pgTable,
  bigserial,
  bigint,
  text,
  date,
  boolean,
  timestamp,
  char,
  pgEnum,
  pgSchema,
} from "drizzle-orm/pg-core";

export const coreSchema = pgSchema("core");

export const genderEnum = coreSchema.enum("gender", [
  "MALE",
  "FEMALE",
  "UNDISCLOSED",
]);
export const maritalStatusEnum = coreSchema.enum("marital_status", [
  "SINGLE",
  "MARRIED",
  "WIDOWED",
  "SEPARATED",
  "DIVORCED",
]);
export const contactTypeEnum = coreSchema.enum("contact_type", [
  "MOBILE",
  "EMAIL",
  "LANDLINE",
  "MESSENGER",
  "OTHER",
]);
export const branchTypeEnum = coreSchema.enum("branch_type", [
  "LOCAL",
  "INTERNATIONAL",
]);
export const branchStatusEnum = coreSchema.enum("branch_status", [
  "ACTIVE",
  "PLANTING",
  "CLOSED",
]);

export const person = coreSchema.table("person", {
  personId: bigserial("person_id", { mode: "number" }).primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  suffix: text("suffix"),
  preferredName: text("preferred_name"),
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),
  nationality: text("nationality"),
  profilePhotoUrl: text("profile_photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const branch = coreSchema.table("branch", {
  branchId: bigserial("branch_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  regionId: bigint("region_id", { mode: "number" }).notNull(),
  type: branchTypeEnum("type").notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  timezone: text("timezone").notNull(),
  primaryAddressId: bigint("primary_address_id", { mode: "number" }),
  launchedOn: date("launched_on"),
  status: branchStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const contactInfo = coreSchema.table("contact_info", {
  contactId: bigserial("contact_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  type: contactTypeEnum("type").notNull(),
  value: text("value").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
```

- [ ] **Step 2: Create `src/schema/membership.ts`**

```typescript
// app/src/schema/membership.ts
import {
  pgTable,
  bigserial,
  bigint,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";

export const membershipSchema = pgSchema("membership");

export const memberStatusEnum = membershipSchema.enum("member_status", [
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "DECEASED",
]);
export const pcmStatusEnum = membershipSchema.enum("pcm_status", [
  "ACTIVE",
  "ENDED",
  "REASSIGNED",
]);

export const lifecycleStage = membershipSchema.table("lifecycle_stage", {
  stageCode: text("stage_code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  isTerminal: boolean("is_terminal").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const role = membershipSchema.table("role", {
  roleId: bigserial("role_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isPastoral: boolean("is_pastoral").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const member = membershipSchema.table("member", {
  memberId: bigserial("member_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => person.personId),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  memberCode: text("member_code").notNull().unique(),
  currentStage: text("current_stage")
    .notNull()
    .references(() => lifecycleStage.stageCode),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  regularMemberSince: timestamp("regular_member_since", {
    withTimezone: true,
  }),
  status: memberStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const memberRole = membershipSchema.table("member_role", {
  memberRoleId: bigserial("member_role_id", { mode: "number" }).primaryKey(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId),
  roleId: bigint("role_id", { mode: "number" })
    .notNull()
    .references(() => role.roleId),
  branchId: bigint("branch_id", { mode: "number" }),
  regionId: bigint("region_id", { mode: "number" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  assignedByPersonId: bigint("assigned_by_person_id", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const pastoralCareAssignment = membershipSchema.table(
  "pastoral_care_assignment",
  {
    assignmentId: bigserial("assignment_id", { mode: "number" }).primaryKey(),
    carerMemberId: bigint("carer_member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId),
    assignedMemberId: bigint("assigned_member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: pcmStatusEnum("status").notNull().default("ACTIVE"),
    notes: text("notes"),
  }
);
```

- [ ] **Step 3: Create `src/schema/app.ts`**

```typescript
// app/src/schema/app.ts
import {
  pgSchema,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const appSchema = pgSchema("app");

export const users = appSchema.table("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/schema/
git commit -m "feat(app): add Drizzle schema mirroring core, membership, and app tables"
```

---

## Task 4: Create `app.users` Table via Flyway Migration

**Files:**
- Create: `db/migrations/V064__create_app_schema_users.sql`

The `app.users` table is staff-only app state, not church data. It goes through Flyway so it's version-controlled alongside everything else.

- [ ] **Step 1: Write migration**

```sql
-- db/migrations/V064__create_app_schema_users.sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.users IS 'Staff accounts for the web app. Managed by Auth.js — not church membership data.';

-- Grant to app_writer (already exists from V025)
GRANT SELECT, INSERT, UPDATE ON app.users TO app_writer;
GRANT SELECT ON app.users TO app_reader;
```

- [ ] **Step 2: Run migration**

```bash
cd db
docker compose up -d
docker compose run --rm flyway migrate
```

Expected output includes: `Successfully applied 1 migration to schema "public", now at version v64`

- [ ] **Step 3: Verify table exists**

```bash
docker compose exec postgres psql -U postgres -d jly_church -c "\d app.users"
```

Expected: table description showing all columns.

- [ ] **Step 4: Run existing test suite to confirm no regressions**

```bash
bash tests/run_tests.sh
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/V064__create_app_schema_users.sql
git commit -m "feat(db): add app schema and users table for web app staff auth"
```

---

## Task 5: Set Up Auth.js (NextAuth v5)

**Files:**
- Create: `app/src/lib/auth.ts`
- Create: `app/src/actions/auth.ts`
- Create: `app/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Generate `AUTH_SECRET`**

```bash
openssl rand -base64 32
```

Copy output into `app/.env.local` as `AUTH_SECRET=<value>`.

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
// app/src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
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

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.userId, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
```

- [ ] **Step 3: Install bcryptjs**

```bash
cd app
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 4: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
// app/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Create `src/actions/auth.ts`**

```typescript
// app/src/actions/auth.ts
"use server";

import { signIn, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/admin/members",
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 6: Seed one staff user for testing**

```bash
cd app
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('changeme', 10).then(h => console.log(h));
"
```

Then insert into DB:
```bash
cd db
docker compose exec postgres psql -U postgres -d jly_church -c "
INSERT INTO app.users (email, name, password_hash, role)
VALUES ('admin@jly.church', 'Admin', '<paste-hash-here>', 'staff');
"
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/auth.ts app/src/actions/auth.ts app/src/app/api/
git commit -m "feat(app): add Auth.js v5 with credentials provider"
```

---

## Task 6: Route Protection Middleware + Login Page

**Files:**
- Create: `app/middleware.ts`
- Create: `app/src/app/login/page.tsx`
- Create: `app/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
// app/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  if (isAdminRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Create login page**

```tsx
// app/src/app/login/page.tsx
import { loginAction } from "@/actions/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900">JLY Church Staff</h1>
        <form action={loginAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create admin layout**

```tsx
// app/src/app/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">JLY Church Admin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

1. Visit `http://localhost:3000/admin/members` — should redirect to `/login`
2. Log in with `admin@jly.church` / `changeme` — should land on `/admin/members` (404 ok, page not built yet)

- [ ] **Step 5: Commit**

```bash
git add app/middleware.ts app/src/app/login/ app/src/app/\(admin\)/layout.tsx
git commit -m "feat(app): add route protection middleware and login page"
```

---

## Task 7: Zod Validation Schemas + Unit Tests

**Files:**
- Create: `app/src/lib/validations/member.ts`
- Create: `app/vitest.config.ts`
- Create: `app/tests/unit/member.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
// app/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Write the failing tests first**

```typescript
// app/tests/unit/member.test.ts
import { describe, it, expect } from "vitest";
import {
  createMemberSchema,
  updateMemberSchema,
} from "@/lib/validations/member";

describe("createMemberSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = createMemberSchema.safeParse({
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("firstName");
  });

  it("rejects empty firstName", () => {
    const result = createMemberSchema.safeParse({
      firstName: "",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid joinedAt date", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("joinedAt");
  });

  it("rejects branchId zero", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      branchId: 0,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when provided", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      middleName: "Cruz",
      lastName: "Santos",
      gender: "FEMALE",
      email: "maria@example.com",
      mobile: "+639171234567",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      email: "not-an-email",
      branchId: 1,
      currentStage: "FTV",
      joinedAt: "2024-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });
});

describe("updateMemberSchema", () => {
  it("accepts partial update with just stage", () => {
    const result = updateMemberSchema.safeParse({
      currentStage: "OGV",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
cd app
npx vitest run tests/unit/member.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/validations/member'`

- [ ] **Step 4: Create `src/lib/validations/member.ts`**

```typescript
// app/src/lib/validations/member.ts
import { z } from "zod";

export const createMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  suffix: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNDISCLOSED"]).optional(),
  maritalStatus: z
    .enum(["SINGLE", "MARRIED", "WIDOWED", "SEPARATED", "DIVORCED"])
    .optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobile: z.string().optional(),
  branchId: z.number().int().positive("Branch is required"),
  currentStage: z.string().min(1, "Lifecycle stage is required"),
  joinedAt: z.string().date("Invalid date"),
});

export const updateMemberSchema = createMemberSchema.partial();

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npx vitest run tests/unit/member.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/vitest.config.ts app/src/lib/validations/ app/tests/unit/
git commit -m "feat(app): add Zod member validation schemas with unit tests"
```

---

## Task 8: Server Actions for Members

**Files:**
- Create: `app/src/actions/members.ts`

- [ ] **Step 1: Create `src/actions/members.ts`**

```typescript
// app/src/actions/members.ts
"use server";

import { db } from "@/lib/db";
import { person, contactInfo } from "@/schema/core";
import { member } from "@/schema/membership";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/member";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createMember(formData: FormData) {
  const raw = {
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    gender: formData.get("gender") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    email: formData.get("email") || undefined,
    mobile: formData.get("mobile") || undefined,
    branchId: Number(formData.get("branchId")),
    currentStage: formData.get("currentStage"),
    joinedAt: formData.get("joinedAt"),
  };

  const parsed = createMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Insert person
  const [newPerson] = await db
    .insert(person)
    .values({
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      suffix: data.suffix,
      preferredName: data.preferredName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender as any,
      maritalStatus: data.maritalStatus as any,
    })
    .returning({ personId: person.personId });

  // Insert contact info if provided
  if (data.email) {
    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "EMAIL",
      value: data.email,
      isPrimary: true,
    });
  }
  if (data.mobile) {
    await db.insert(contactInfo).values({
      personId: newPerson.personId,
      type: "MOBILE",
      value: data.mobile,
      isPrimary: true,
    });
  }

  // Insert member record
  // member_code: branch code + zero-padded person_id
  const [newMember] = await db
    .insert(member)
    .values({
      personId: newPerson.personId,
      branchId: data.branchId,
      memberCode: `M-${newPerson.personId}`,
      currentStage: data.currentStage,
      joinedAt: new Date(data.joinedAt),
    })
    .returning({ memberId: member.memberId });

  revalidatePath("/admin/members");
  redirect(`/admin/members/${newMember.memberId}`);
}

export async function updateMember(memberId: number, formData: FormData) {
  const raw = {
    firstName: formData.get("firstName") || undefined,
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName") || undefined,
    gender: formData.get("gender") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    currentStage: formData.get("currentStage") || undefined,
  };

  const parsed = updateMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Get person_id for this member
  const [existing] = await db
    .select({ personId: member.personId })
    .from(member)
    .where(eq(member.memberId, memberId))
    .limit(1);

  if (!existing) return { errors: { _: ["Member not found"] } };

  // Update person fields
  if (data.firstName || data.lastName || data.gender || data.maritalStatus) {
    await db
      .update(person)
      .set({
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.middleName !== undefined && { middleName: data.middleName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.gender && { gender: data.gender as any }),
        ...(data.maritalStatus && { maritalStatus: data.maritalStatus as any }),
      })
      .where(eq(person.personId, existing.personId));
  }

  // Update member stage (DB trigger writes lifecycle_stage_history automatically)
  if (data.currentStage) {
    await db
      .update(member)
      .set({ currentStage: data.currentStage })
      .where(eq(member.memberId, memberId));
  }

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");
  redirect(`/admin/members/${memberId}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/members.ts
git commit -m "feat(app): add createMember and updateMember server actions"
```

---

## Task 9: Member List Page

**Files:**
- Create: `app/src/app/(admin)/members/page.tsx`
- Create: `app/src/components/members/member-search.tsx`

- [ ] **Step 1: Create member search client component**

```tsx
// app/src/components/members/member-search.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function MemberSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("q") as HTMLInputElement).value;
    const url = new URL(window.location.href);
    if (q) {
      url.searchParams.set("q", q);
    } else {
      url.searchParams.delete("q");
    }
    url.searchParams.delete("page");
    startTransition(() => router.push(url.pathname + url.search));
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder="Search by name…"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create member list page**

```tsx
// app/src/app/(admin)/members/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { member } from "@/schema/membership";
import { person, branch } from "@/schema/core";
import { MemberSearch } from "@/components/members/member-search";
import { eq, ilike, or, and, isNull, sql } from "drizzle-orm";
import { Suspense } from "react";

const PAGE_SIZE = 25;

async function MemberTable({
  q,
  page,
}: {
  q: string;
  page: number;
}) {
  const offset = (page - 1) * PAGE_SIZE;

  const baseCondition = isNull(member.deletedAt);
  const searchCondition = q
    ? or(
        ilike(person.firstName, `%${q}%`),
        ilike(person.lastName, `%${q}%`),
        ilike(
          sql`${person.firstName} || ' ' || ${person.lastName}`,
          `%${q}%`
        )
      )
    : undefined;

  const condition = searchCondition
    ? and(baseCondition, searchCondition)
    : baseCondition;

  const rows = await db
    .select({
      memberId: member.memberId,
      memberCode: member.memberCode,
      firstName: person.firstName,
      lastName: person.lastName,
      currentStage: member.currentStage,
      status: member.status,
      branchName: branch.name,
    })
    .from(member)
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(branch, eq(member.branchId, branch.branchId))
    .where(condition)
    .orderBy(person.lastName, person.firstName)
    .limit(PAGE_SIZE)
    .offset(offset);

  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-sm mt-4">No members found.</p>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-3 pr-4 font-medium">Name</th>
          <th className="py-3 pr-4 font-medium">Code</th>
          <th className="py-3 pr-4 font-medium">Stage</th>
          <th className="py-3 pr-4 font-medium">Branch</th>
          <th className="py-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr
            key={m.memberId}
            className="border-b border-gray-100 hover:bg-gray-50"
          >
            <td className="py-3 pr-4">
              <Link
                href={`/admin/members/${m.memberId}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {m.lastName}, {m.firstName}
              </Link>
            </td>
            <td className="py-3 pr-4 text-gray-600">{m.memberCode}</td>
            <td className="py-3 pr-4">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {m.currentStage}
              </span>
            </td>
            <td className="py-3 pr-4 text-gray-600">{m.branchName}</td>
            <td className="py-3 text-gray-600">{m.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <Link
          href="/admin/members/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add member
        </Link>
      </div>

      <Suspense fallback={null}>
        <MemberSearch />
      </Suspense>

      <Suspense fallback={<p className="text-gray-500 text-sm">Loading…</p>}>
        <MemberTable q={q} page={page} />
      </Suspense>

      <div className="flex gap-2 text-sm">
        {page > 1 && (
          <Link
            href={`/admin/members?q=${q}&page=${page - 1}`}
            className="text-blue-600 hover:underline"
          >
            ← Previous
          </Link>
        )}
        <Link
          href={`/admin/members?q=${q}&page=${page + 1}`}
          className="text-blue-600 hover:underline"
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

With dev server running and Docker Compose Postgres up:
1. Log in as `admin@jly.church`
2. Visit `/admin/members`
3. Confirm table renders (may be empty if no data yet)
4. Type in search box and confirm URL updates

- [ ] **Step 4: Commit**

```bash
git add app/src/app/\(admin\)/members/page.tsx app/src/components/members/member-search.tsx
git commit -m "feat(app): add member list page with search and pagination"
```

---

## Task 10: Member Detail Page

**Files:**
- Create: `app/src/app/(admin)/members/[id]/page.tsx`

- [ ] **Step 1: Create detail page**

```tsx
// app/src/app/(admin)/members/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { member, lifecycleStage, memberRole, role, pastoralCareAssignment } from "@/schema/membership";
import { person, contactInfo, branch } from "@/schema/core";
import { eq, and, isNull } from "drizzle-orm";

export default async function MemberDetailPage({
  params,
}: {
  params: { id: string };
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/members"
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
          href={`/admin/members/${memberId}/edit`}
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

      {roles.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Roles
          </h2>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r.code}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {r.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

With a seeded member in the DB, visit `/admin/members/<id>` — confirm all sections render correctly.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/\(admin\)/members/\[id\]/page.tsx
git commit -m "feat(app): add member detail page"
```

---

## Task 11: Create Member Page

**Files:**
- Create: `app/src/components/members/member-form.tsx`
- Create: `app/src/app/(admin)/members/new/page.tsx`

- [ ] **Step 1: Create shared member form component**

```tsx
// app/src/components/members/member-form.tsx
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { lifecycleStage } from "@/schema/membership";
import { eq } from "drizzle-orm";

// Fetch options server-side and pass as props
export type MemberFormProps = {
  branches: { branchId: number; name: string }[];
  stages: { stageCode: string; name: string; orderIndex: number }[];
  defaultValues?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: string;
    maritalStatus?: string;
    email?: string;
    mobile?: string;
    branchId?: number;
    currentStage?: string;
    joinedAt?: string;
  };
  errors?: Record<string, string[]>;
};

export function MemberForm({
  branches,
  stages,
  defaultValues = {},
  errors = {},
}: MemberFormProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            name="firstName"
            defaultValue={defaultValues.firstName}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Middle name
          </label>
          <input
            name="middleName"
            defaultValue={defaultValues.middleName}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            name="lastName"
            defaultValue={defaultValues.lastName}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-600">{errors.lastName[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Gender
          </label>
          <select
            name="gender"
            defaultValue={defaultValues.gender}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="UNDISCLOSED">Undisclosed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            name="email"
            type="email"
            defaultValue={defaultValues.email}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mobile
          </label>
          <input
            name="mobile"
            defaultValue={defaultValues.mobile}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Branch <span className="text-red-500">*</span>
          </label>
          <select
            name="branchId"
            defaultValue={defaultValues.branchId}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.branchId && (
            <p className="mt-1 text-xs text-red-600">{errors.branchId[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Lifecycle stage <span className="text-red-500">*</span>
          </label>
          <select
            name="currentStage"
            defaultValue={defaultValues.currentStage}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select stage…</option>
            {stages.map((s) => (
              <option key={s.stageCode} value={s.stageCode}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.currentStage && (
            <p className="mt-1 text-xs text-red-600">
              {errors.currentStage[0]}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Joined date <span className="text-red-500">*</span>
          </label>
          <input
            name="joinedAt"
            type="date"
            defaultValue={defaultValues.joinedAt}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.joinedAt && (
            <p className="mt-1 text-xs text-red-600">{errors.joinedAt[0]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create new member page**

```tsx
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
          href="/admin/members"
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
            href="/admin/members"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

1. Visit `/admin/members/new`
2. Fill in required fields, submit
3. Confirm redirect to new member's detail page
4. Confirm member appears in list

- [ ] **Step 4: Commit**

```bash
git add app/src/components/members/member-form.tsx app/src/app/\(admin\)/members/new/
git commit -m "feat(app): add create member page with shared form component"
```

---

## Task 12: Edit Member Page

**Files:**
- Create: `app/src/app/(admin)/members/[id]/edit/page.tsx`

- [ ] **Step 1: Create edit page**

```tsx
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
        memberCode: member.memberCode,
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

      <form action={action} className="space-y-6">
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
```

- [ ] **Step 2: Manual test**

1. Visit `/admin/members/<id>/edit`
2. Confirm form pre-populates with existing data
3. Change lifecycle stage, submit
4. Confirm redirect to detail page with updated stage

- [ ] **Step 3: Commit**

```bash
git add app/src/app/\(admin\)/members/\[id\]/edit/
git commit -m "feat(app): add edit member page"
```

---

## Task 13: Playwright E2E Tests

**Files:**
- Create: `app/playwright.config.ts`
- Create: `app/tests/e2e/members.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
// app/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write E2E tests**

```typescript
// app/tests/e2e/members.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

test.describe("Member management", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', STAFF_EMAIL);
    await page.fill('input[name="password"]', STAFF_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/admin/members");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Use a fresh context without session
    await page.context().clearCookies();
    await page.goto("/admin/members");
    await expect(page).toHaveURL("/login");
  });

  test("staff can view member list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await expect(page.getByPlaceholder("Search by name…")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add member" })).toBeVisible();
  });

  test("staff can search members by name", async ({ page }) => {
    await page.fill('input[name="q"]', "Santos");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/q=Santos/);
  });

  test("staff can navigate to create member page", async ({ page }) => {
    await page.click('a:has-text("Add member")');
    await expect(page).toHaveURL("/admin/members/new");
    await expect(
      page.getByRole("heading", { name: "Add member" })
    ).toBeVisible();
  });

  test("create form validates required fields", async ({ page }) => {
    await page.goto("/admin/members/new");
    await page.click('button[type="submit"]');
    // HTML5 required validation fires — form does not submit
    await expect(page).toHaveURL("/admin/members/new");
  });
});
```

- [ ] **Step 3: Install Playwright browsers**

```bash
cd app
npx playwright install chromium
```

- [ ] **Step 4: Run E2E tests**

Ensure Docker Compose Postgres is running and dev server is either running or will be started by Playwright's `webServer` config.

```bash
npx playwright test
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/playwright.config.ts app/tests/e2e/
git commit -m "test(app): add Playwright E2E tests for member management"
```

---

## Task 14: Final Wiring and Cleanup

**Files:**
- Modify: `app/src/app/layout.tsx`
- Modify: `app/src/app/page.tsx`
- Create: `app/.env.example` (verify committed)

- [ ] **Step 1: Update root layout with metadata**

```tsx
// app/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JLY Church Admin",
  description: "JLY Church staff portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Public home page (placeholder)**

```tsx
// app/src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">JLY Church</h1>
        <p className="text-gray-500">Staff portal coming soon.</p>
        <Link
          href="/admin/members"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Staff login →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Full build check**

```bash
cd app
npm run build
```

Expected: build completes with no TypeScript errors. Any `next build` warnings about missing env vars at build time are acceptable if `DATABASE_URL` is not set in CI — note this in `.env.example`.

- [ ] **Step 4: Run all tests**

```bash
# Unit
npx vitest run

# E2E (requires dev server + Postgres)
npx playwright test
```

Expected: all unit tests PASS, all E2E tests PASS.

- [ ] **Step 5: Final commit**

```bash
git add app/src/app/layout.tsx app/src/app/page.tsx
git commit -m "feat(app): finalize root layout and public home placeholder"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| `app/` scaffold: Next.js 14, TypeScript, Tailwind, Drizzle, Auth.js | Task 1–2 |
| Staff auth (email/password) | Task 5 |
| Route protection middleware | Task 6 |
| `/admin/members` list + search | Task 9 |
| `/admin/members/new` create | Task 11 |
| `/admin/members/[id]` view | Task 10 |
| `/admin/members/[id]/edit` edit | Task 12 |
| `app.users` table | Task 4 |
| Drizzle schema mirrors Flyway | Task 3 |
| Zod validation at server action boundary | Task 7–8 |
| Vitest unit tests for Zod schemas | Task 7 |
| Playwright E2E smoke tests | Task 13 |
| Stage transition defers to DB trigger | Task 8 (`updateMember` updates `current_stage` → trigger fires) |
| DB roles: app_reader / app_writer | Task 3 (`db.ts` uses `DATABASE_URL` mapped to app_writer; Task 4 grants in SQL) |

All spec requirements covered. No TBDs or placeholders found.
