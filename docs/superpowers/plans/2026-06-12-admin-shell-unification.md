# Admin Shell Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/users` renders inside the shared `DashboardShell`, and the admin sidebar gains role-filtered links (Users for SUPER_ADMIN; My Dashboard + Ministry Dashboard for all admins) — navigation is UI only, authorization unchanged.

**Architecture:** Convert the static `adminNavItems` export into a pure `adminNavForRole(role)` filter (mirrors `memberNavForRole`); move `app/src/app/users/` into the `(admin)` route group so it inherits the admin layout (URL `/users` unchanged); restyle the users page to the lime design system. Middleware, `requireRole`, and `hasRole` are not touched.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind + CSS variables, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-12-admin-shell-unification-design.md`

**Branch/worktree:** `member-dashboard-redesign` at `.worktrees/member-dashboard-redesign` (extends open PR #15). All commands run from `.worktrees/member-dashboard-redesign/app` unless noted.

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/src/lib/admin-nav.tsx` | Modify | Replace `adminNavItems` const export with `adminNavForRole(role)` pure filter |
| `app/src/app/(admin)/layout.tsx` | Modify | Pass `adminNavForRole(session role)` to shell |
| `app/src/app/(admin)/users/page.tsx` | Move + rewrite | `git mv` from `app/src/app/users/`; restyle to lime design system |
| `app/tests/unit/admin-nav.test.tsx` | Create | Role filtering of admin nav |
| `app/tests/e2e/member-dashboard.spec.ts` | Modify | Admin sees Users link; `/users` renders in shell |

---

### Task 1: `adminNavForRole` (TDD)

**Files:**
- Modify: `app/src/lib/admin-nav.tsx`
- Create: `app/tests/unit/admin-nav.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// app/tests/unit/admin-nav.test.tsx
import { describe, expect, it } from "vitest";
import { adminNavForRole } from "@/lib/admin-nav";

const hrefs = (role: Parameters<typeof adminNavForRole>[0]) =>
  adminNavForRole(role).map((i) => i.href);

describe("adminNavForRole", () => {
  it("ADMIN gets 10 admin items + cross-links, no Users", () => {
    const h = hrefs("ADMIN");
    expect(h).toHaveLength(12);
    expect(h).not.toContain("/users");
    expect(h).toContain("/me");
    expect(h).toContain("/ministry");
  });
  it("SUPER_ADMIN additionally gets Users", () => {
    const h = hrefs("SUPER_ADMIN");
    expect(h).toHaveLength(13);
    expect(h).toContain("/users");
  });
  it("Users appears before the cross-links", () => {
    const h = hrefs("SUPER_ADMIN");
    expect(h.indexOf("/users")).toBeLessThan(h.indexOf("/me"));
  });
  it("every item has a label and an icon", () => {
    for (const item of adminNavForRole("SUPER_ADMIN")) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/admin-nav.test.tsx
```

Expected: FAIL — `adminNavForRole` is not exported.

- [ ] **Step 3: Implement**

In `app/src/lib/admin-nav.tsx`:

1. Add imports at the top (after the existing comment):

```tsx
import { hasRole, type Role } from "@/lib/authz";
```

2. Rename the existing exported const `adminNavItems` to a non-exported `baseItems` (keep all 10 items and their SVGs exactly as they are — only the declaration line changes):

```tsx
const baseItems: ShellNavItem[] = [
  // ...the existing 10 items, unchanged...
];
```

3. Append below the array:

```tsx
const usersItem: ShellNavItem = {
  href: "/users",
  label: "Users",
  icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
      <path strokeLinecap="round" d="M19 8h4M21 6v4" />
    </svg>
  ),
};

const myDashboardItem: ShellNavItem = {
  href: "/me",
  label: "My Dashboard",
  icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  ),
};

const ministryDashboardItem: ShellNavItem = {
  href: "/ministry",
  label: "Ministry Dashboard",
  icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
};

/**
 * Admin sidebar for a given role. Nav visibility is presentation only —
 * middleware + requireRole still enforce access on every route.
 */
export function adminNavForRole(role: Role): ShellNavItem[] {
  const items = [...baseItems];
  if (hasRole(role, "SUPER_ADMIN")) items.push(usersItem);
  items.push(myDashboardItem, ministryDashboardItem);
  return items;
}
```

Note: `adminNavItems` is no longer exported — Task 2 updates its only consumer (`(admin)/layout.tsx`). `ShellNavItem` stays exported (used by `member-nav.tsx` and `dashboard-shell.tsx`).

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run tests/unit/admin-nav.test.tsx
```

Expected: 4 tests PASS. (`tsc` will fail until Task 2 fixes the layout import — that's expected mid-task.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-nav.tsx tests/unit/admin-nav.test.tsx
git commit -m "feat(nav): role-filtered admin nav with Users + dashboard cross-links"
```

---

### Task 2: Admin layout passes role-filtered nav

**Files:**
- Modify: `app/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Rewrite layout**

```tsx
// app/src/app/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { adminNavForRole } from "@/lib/admin-nav";
import type { Role } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user?.role ?? "MEMBER") as Role;

  return (
    <DashboardShell
      navItems={adminNavForRole(role)}
      portalLabel="Admin Portal"
      brandHref="/members"
      user={{
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: tsc clean; all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/layout.tsx"
git commit -m "feat(admin): sidebar nav filtered by role"
```

---

### Task 3: Move `/users` into `(admin)` + restyle

**Files:**
- Move: `app/src/app/users/page.tsx` → `app/src/app/(admin)/users/page.tsx`
- Rewrite: the moved page (markup only; query + guard + `UserRoleControls` props unchanged)

- [ ] **Step 1: Move the route (URL stays `/users`)**

```bash
git mv src/app/users "src/app/(admin)/users"
```

- [ ] **Step 2: Rewrite the moved page**

```tsx
// app/src/app/(admin)/users/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
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
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-6 md:px-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Users
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Accounts, roles, and access
        </p>
      </div>

      <div className="card overflow-x-auto p-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{u.email}</td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.name ?? "—"}</td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.role}</td>
                <td className="py-2 pr-4">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      u.isActive
                        ? { background: "var(--lime-soft)", color: "var(--text-primary)" }
                        : { background: "var(--bg-inset)", color: "var(--text-muted)" }
                    }
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
    </div>
  );
}
```

Changes vs original: shell provides chrome so the standalone "My profile" link is dropped (sidebar has My Dashboard); gray/blue Tailwind colors → design-system CSS variables; table wrapped in `card`. Query, `requireRole("SUPER_ADMIN")`, and all `UserRoleControls` props are identical.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: both clean. Build route list shows `/users` (route group does not change the URL).

- [ ] **Step 4: Commit**

```bash
git add -A "src/app/(admin)/users" src/app/users
git commit -m "feat(users): render user management inside admin DashboardShell"
```

---

### Task 4: E2E — admin shell shows Users link, /users renders in shell

**Files:**
- Modify: `app/tests/e2e/member-dashboard.spec.ts`

- [ ] **Step 1: Append test inside the existing `test.describe("Member dashboard shell", ...)` block** (the seeded `admin@jly.church` is SUPER_ADMIN in the E2E DB; `login` helper already exists in this spec):

```ts
  test("super admin reaches /users from sidebar, page renders in shell", async ({ page }) => {
    await login(page, "admin@jly.church", "changeme", "/members");
    await expect(page.getByRole("link", { name: "My Dashboard", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.waitForURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    // Shell chrome present: sidebar still shows admin items.
    await expect(page.getByRole("link", { name: "Members", exact: true })).toBeVisible();
  });
```

- [ ] **Step 2: Run E2E vs local DB** (`jly_postgres` container must be up)

```bash
npx playwright test tests/e2e/member-dashboard.spec.ts
```

Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/member-dashboard.spec.ts
git commit -m "test(e2e): super admin Users nav + shell on /users"
```

---

### Task 5: Final gates + docs + push

- [ ] **Step 1: Full unit suite + types + build**

```bash
npx vitest run && npx tsc --noEmit && npm run build
```

Expected: all clean (297 unit tests: 293 existing + 4 new).

- [ ] **Step 2: E2E trio vs local DB**

```bash
npx playwright test tests/e2e/member-dashboard.spec.ts tests/e2e/roles-journey.spec.ts tests/e2e/admin-smoke.spec.ts
```

Expected: 12 PASS (5 + 6 + 1).

- [ ] **Step 3: Update `CLAUDE.md`** (worktree root copy): extend the Member Dashboard Redesign bullet with "admin shell unification: `/users` moved under `(admin)` shell, role-filtered admin nav with Users + My/Ministry Dashboard cross-links".

```bash
git add ../CLAUDE.md
git commit -m "docs: record admin shell unification in project handoff"
```

- [ ] **Step 4: Push (updates open PR #15)**

```bash
git push
```

Expected: PR #15 picks up the new commits. Comment on the PR noting the scope addition.
