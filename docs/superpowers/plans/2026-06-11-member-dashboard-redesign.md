# Member Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member dashboard (`/me`, `/ministry`) gets the same sidebar shell as the admin portal via one shared `DashboardShell`, `/me` splits into Overview / Attendance / Ministries / Announcements pages, and Framer Motion adds interactive animation.

**Architecture:** Extract admin chrome into a client `DashboardShell` (sidebar + topbar + mobile drawer) parameterized by nav items; admin and member layouts both use it. Pages stay server components; animation lives in small client widgets (`MotionCard`, `AnimatedNumber`, `JourneyLadder`).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind + CSS variables (lime design system), Drizzle ORM, NextAuth v5, Framer Motion (new dep), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-member-dashboard-redesign-design.md`

**Decisions locked at plan time:**
- `/me/attendance` is list-only (no personal trend chart) — per-member weekly buckets are too sparse to chart meaningfully.
- Existing E2E `roles-journey.spec.ts` expects heading **"Journey"** and chip **"Regular Member"** on `/me` — the new overview page keeps both.
- `src/actions/auth.ts` starts with `"use server"`, so `logoutAction` is importable from the client shell.

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/src/lib/member-nav.tsx` | Create | Member nav items + `memberNavForRole(role)` pure filter |
| `app/src/lib/admin-nav.tsx` | Create | Admin nav items (moved from `sidebar-nav.tsx`) |
| `app/src/lib/greeting.ts` | Create | `greetingForHour`, `manilaHour` pure helpers |
| `app/src/lib/member-announcements.ts` | Create | Pure feed helpers: `previewText`, `formatAnnouncementDate` |
| `app/src/components/dashboard-shell.tsx` | Create | Client shell: sidebar, topbar, drawer, nav pill, user card |
| `app/src/components/motion-card.tsx` | Create | Entrance fade-up + hover lift wrapper |
| `app/src/components/animated-number.tsx` | Create | Count-up number |
| `app/src/components/journey-ladder.tsx` | Create | Animated stage ladder + progress fill |
| `app/src/app/(admin)/layout.tsx` | Modify | Thin wrapper → `DashboardShell` |
| `app/src/app/me/layout.tsx` | Modify | Shell with member nav |
| `app/src/app/ministry/layout.tsx` | Modify | Shell with member nav |
| `app/src/app/me/page.tsx` | Rewrite | Overview only |
| `app/src/app/me/attendance/page.tsx` | Create | Personal attendance |
| `app/src/app/me/ministries/page.tsx` | Create | Memberships + join requests + join form |
| `app/src/app/me/announcements/page.tsx` | Create | Read-only announcements feed |
| `app/src/components/sidebar-nav.tsx` | Delete | Absorbed into shell + `admin-nav.tsx` |
| `app/src/components/member-shell.tsx` | Delete | Replaced by shell |
| `app/tests/unit/member-nav.test.tsx` | Create | Nav role filtering |
| `app/tests/unit/greeting.test.ts` | Create | Greeting helpers |
| `app/tests/unit/member-announcements.test.ts` | Create | Feed helpers |
| `app/tests/e2e/member-dashboard.spec.ts` | Create | Member shell navigation E2E |

All commands below run from `app/` unless noted. Repo root: `C:\Users\Admin\Desktop\App\JLYCC App`.

---

### Task 1: Branch + install Framer Motion

- [ ] **Step 1: Create branch**

```bash
git checkout master && git checkout -b member-dashboard-redesign
```

- [ ] **Step 2: Install dependency**

```bash
cd app && npm install framer-motion
```

Expected: `framer-motion` added to `dependencies` in `app/package.json` (v11+ or v12+).

- [ ] **Step 3: Sanity check build tooling still resolves**

```bash
npx tsc --noEmit
```

Expected: clean (no output).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add framer-motion for dashboard animations"
```

---

### Task 2: `greeting.ts` helpers (TDD)

**Files:**
- Create: `app/src/lib/greeting.ts`
- Test: `app/tests/unit/greeting.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// app/tests/unit/greeting.test.ts
import { describe, expect, it } from "vitest";
import { greetingForHour, manilaHour } from "@/lib/greeting";

describe("greetingForHour", () => {
  it("morning before noon", () => {
    expect(greetingForHour(0)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
  });
  it("afternoon from 12 to 17", () => {
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
  });
  it("evening from 18", () => {
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
  });
});

describe("manilaHour", () => {
  it("converts UTC to Asia/Manila (+8)", () => {
    // 2026-06-11T00:30:00Z == 08:30 Manila
    expect(manilaHour(new Date("2026-06-11T00:30:00Z"))).toBe(8);
    // 2026-06-11T17:00:00Z == 01:00 next day Manila
    expect(manilaHour(new Date("2026-06-11T17:00:00Z"))).toBe(1);
  });
  it("midnight Manila is 0, not 24", () => {
    expect(manilaHour(new Date("2026-06-10T16:00:00Z"))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/greeting.test.ts
```

Expected: FAIL — cannot resolve `@/lib/greeting`.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/greeting.ts
// Pure time-of-day helpers for the member dashboard greeting.

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Hour of day (0-23) in Asia/Manila for the given instant. */
export function manilaHour(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(formatted);
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run tests/unit/greeting.test.ts
```

Expected: 3 tests PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/greeting.ts tests/unit/greeting.test.ts
git commit -m "feat(me): time-of-day greeting helpers (Asia/Manila)"
```

---

### Task 3: `member-announcements.ts` feed helpers (TDD)

**Files:**
- Create: `app/src/lib/member-announcements.ts`
- Test: `app/tests/unit/member-announcements.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// app/tests/unit/member-announcements.test.ts
import { describe, expect, it } from "vitest";
import { previewText, formatAnnouncementDate } from "@/lib/member-announcements";

describe("previewText", () => {
  it("returns short text unchanged", () => {
    expect(previewText("Hello church", 160)).toBe("Hello church");
  });
  it("truncates long text at a word boundary with ellipsis", () => {
    const long = "word ".repeat(100).trim();
    const out = previewText(long, 50);
    expect(out.length).toBeLessThanOrEqual(51); // 50 + ellipsis char
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
  });
  it("collapses newlines to spaces", () => {
    expect(previewText("line one\nline two", 160)).toBe("line one line two");
  });
});

describe("formatAnnouncementDate", () => {
  it("formats a date as e.g. 'Jun 11, 2026'", () => {
    expect(formatAnnouncementDate(new Date("2026-06-11T12:00:00Z"))).toBe(
      "Jun 11, 2026"
    );
  });
  it("returns em dash for null", () => {
    expect(formatAnnouncementDate(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/member-announcements.test.ts
```

Expected: FAIL — cannot resolve `@/lib/member-announcements`.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/member-announcements.ts
// Pure presentation helpers for the member announcements feed.

export function previewText(body: string, max = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function formatAnnouncementDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run tests/unit/member-announcements.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/member-announcements.ts tests/unit/member-announcements.test.ts
git commit -m "feat(me): announcement feed presentation helpers"
```

---

### Task 4: Nav item modules + role filter (TDD)

**Files:**
- Create: `app/src/lib/admin-nav.tsx` (items moved verbatim from `app/src/components/sidebar-nav.tsx:8-108`)
- Create: `app/src/lib/member-nav.tsx`
- Test: `app/tests/unit/member-nav.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// app/tests/unit/member-nav.test.tsx
import { describe, expect, it } from "vitest";
import { memberNavForRole } from "@/lib/member-nav";

const hrefs = (role: Parameters<typeof memberNavForRole>[0]) =>
  memberNavForRole(role).map((i) => i.href);

describe("memberNavForRole", () => {
  it("MEMBER sees base items only", () => {
    expect(hrefs("MEMBER")).toEqual([
      "/me",
      "/me/attendance",
      "/me/ministries",
      "/me/announcements",
      "/church/calendar",
    ]);
  });
  it("MINISTRY_HEAD also sees ministry dashboard", () => {
    expect(hrefs("MINISTRY_HEAD")).toContain("/ministry");
    expect(hrefs("MINISTRY_HEAD")).not.toContain("/members");
  });
  it("ADMIN sees ministry dashboard and admin portal", () => {
    expect(hrefs("ADMIN")).toContain("/ministry");
    expect(hrefs("ADMIN")).toContain("/members");
  });
  it("SUPER_ADMIN sees everything ADMIN sees", () => {
    expect(hrefs("SUPER_ADMIN")).toEqual(hrefs("ADMIN"));
  });
  it("every item has a label and an icon", () => {
    for (const item of memberNavForRole("SUPER_ADMIN")) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/member-nav.test.tsx
```

Expected: FAIL — cannot resolve `@/lib/member-nav`.

- [ ] **Step 3: Create `admin-nav.tsx`**

Move the `NavItem` type and the whole `navItems` array (with all SVG icons) from `app/src/components/sidebar-nav.tsx` lines 6-108 into:

```tsx
// app/src/lib/admin-nav.tsx
// Admin sidebar nav items (icons inline so server layouts can pass them
// to the client DashboardShell as serialized JSX).

export type ShellNavItem = { href: string; label: string; icon: React.ReactNode };

export const adminNavItems: ShellNavItem[] = [
  // ⟵ paste the 10 items (Members … GHL Sync) verbatim from sidebar-nav.tsx
];
```

Do NOT delete `sidebar-nav.tsx` yet (admin layout still imports it until Task 6).

- [ ] **Step 4: Create `member-nav.tsx`**

```tsx
// app/src/lib/member-nav.tsx
// Member sidebar nav. Pure role filter — unit-tested.

import { hasRole, type Role } from "@/lib/authz";
import type { ShellNavItem } from "@/lib/admin-nav";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
} as const;

const baseItems: ShellNavItem[] = [
  {
    href: "/me",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: "/me/attendance",
    label: "My Attendance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3L22 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/me/ministries",
    label: "My Ministries",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
      </svg>
    ),
  },
  {
    href: "/me/announcements",
    label: "Announcements",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/church/calendar",
    label: "Calendar",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
];

const headItem: ShellNavItem = {
  href: "/ministry",
  label: "Ministry Dashboard",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
};

const adminItem: ShellNavItem = {
  href: "/members",
  label: "Admin Portal",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export function memberNavForRole(role: Role): ShellNavItem[] {
  const items = [...baseItems];
  if (hasRole(role, "MINISTRY_HEAD")) items.push(headItem);
  if (hasRole(role, "ADMIN")) items.push(adminItem);
  return items;
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npx vitest run tests/unit/member-nav.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-nav.tsx src/lib/member-nav.tsx tests/unit/member-nav.test.tsx
git commit -m "feat(nav): shared nav item modules + role-filtered member nav"
```

---

### Task 5: Animation widgets

**Files:**
- Create: `app/src/components/motion-card.tsx`
- Create: `app/src/components/animated-number.tsx`
- Create: `app/src/components/journey-ladder.tsx`

UI widgets — no unit tests (no DOM assertions worth their cost here); verified by tsc, build, and E2E.

- [ ] **Step 1: Create `motion-card.tsx`**

```tsx
// app/src/components/motion-card.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

// Entrance fade-up + optional spring hover lift. Children render
// server-side; only the wrapper animates.
export default function MotionCard({
  children,
  delay = 0,
  lift = true,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  lift?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        lift && !reduced
          ? { y: -3, transition: { type: "spring", stiffness: 300, damping: 20 } }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `animated-number.tsx`**

```tsx
// app/src/components/animated-number.tsx
"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

// Count-up on mount. Writes textContent directly to avoid re-renders.
export default function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  // SSR fallback renders the final value so no-JS users see real data.
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
```

- [ ] **Step 3: Create `journey-ladder.tsx`**

```tsx
// app/src/components/journey-ladder.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

export type LadderStage = { stageCode: string; name: string };

// Animated lifecycle ladder: progress bar fills to the current stage,
// chips stagger in, current chip pulses once.
export default function JourneyLadder({
  stages,
  currentCode,
}: {
  stages: LadderStage[];
  currentCode: string | null;
}) {
  const reduced = useReducedMotion();
  const currentIndex = stages.findIndex((s) => s.stageCode === currentCode);
  const progress =
    stages.length <= 1 || currentIndex < 0
      ? 0
      : currentIndex / (stages.length - 1);

  return (
    <div className="space-y-4">
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--bg-inset)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--lime)" }}
          initial={reduced ? { width: `${progress * 100}%` } : { width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </div>
      <ol className="flex flex-wrap items-center gap-2">
        {stages.map((s, i) => {
          const isCurrent = i === currentIndex;
          const passed = currentIndex >= 0 && i < currentIndex;
          return (
            <motion.li
              key={s.stageCode}
              className="flex items-center gap-2"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
            >
              {i > 0 && <span style={{ color: "var(--text-muted)" }}>→</span>}
              <motion.span
                className="rounded-full px-3 py-1 text-xs font-medium"
                animate={
                  isCurrent && !reduced
                    ? { scale: [1, 1.12, 1], transition: { delay: 1, duration: 0.5 } }
                    : undefined
                }
                style={
                  isCurrent
                    ? { background: "var(--lime)", color: "#1C2018", fontWeight: 700 }
                    : passed
                      ? { background: "var(--lime-soft)", color: "var(--text-primary)" }
                      : { background: "var(--bg-inset)", color: "var(--text-muted)" }
                }
              >
                {s.name}
              </motion.span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/motion-card.tsx src/components/animated-number.tsx src/components/journey-ladder.tsx
git commit -m "feat(ui): framer-motion widgets — MotionCard, AnimatedNumber, JourneyLadder"
```

---

### Task 6: `DashboardShell` + migrate admin layout

**Files:**
- Create: `app/src/components/dashboard-shell.tsx`
- Modify: `app/src/app/(admin)/layout.tsx` (full rewrite below)
- Delete: `app/src/components/sidebar-nav.tsx`

- [ ] **Step 1: Create `dashboard-shell.tsx`**

```tsx
// app/src/components/dashboard-shell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { logoutAction } from "@/actions/auth";
import ThemeToggle from "@/components/theme-toggle";
import type { ShellNavItem } from "@/lib/admin-nav";

// Shared chrome for ALL dashboards (admin + member). Sidebar on desktop,
// hamburger → drawer on mobile. Active nav pill animates between items.
export default function DashboardShell({
  navItems,
  portalLabel,
  brandHref,
  user,
  children,
}: {
  navItems: ShellNavItem[];
  portalLabel: string;
  brandHref: string;
  user: { name: string | null; email: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reduced = useReducedMotion();

  // Close the drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Longest-prefix match so /me/attendance doesn't also light up /me.
  const active = navItems.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(item.href + "/");
    if (!matches) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);

  const nav = (
    <nav className="flex w-full flex-1 flex-col gap-1 px-3">
      {navItems.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium"
            style={{
              color: isActive ? "var(--sidebar-icon-active)" : "var(--sidebar-icon)",
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {isActive && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: "var(--sidebar-active-bg)" }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 32 }
                }
              />
            )}
            {!isActive && (
              <span
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: "var(--bg-card-hover)" }}
              />
            )}
            <span className="relative shrink-0 transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </span>
            <span className="relative truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (
    <div
      className="mx-3 mt-4 flex items-center gap-3 rounded-2xl p-3"
      style={{ background: "var(--bg-inset)", border: "1px solid var(--border)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "var(--lime)", color: "#1C2018" }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {user.name ?? "Member"}
        </p>
        <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {user.email}
        </p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          title="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </form>
    </div>
  );

  const brand = (
    <Link href={brandHref} className="mb-6 flex items-center gap-3 px-5">
      <span className="flex h-9 w-9 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jlycc-logo.png" alt="JLYCC" width={36} height={36} style={{ objectFit: "contain" }} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        JLYCC
      </span>
    </Link>
  );

  return (
    <div className="relative z-10 flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden shrink-0 flex-col py-5 md:flex"
        style={{
          width: "var(--sidebar-width)",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {brand}
        {nav}
        {userCard}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col py-5 md:hidden"
              style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
              initial={reduced ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              {brand}
              {nav}
              {userCard}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between px-4 md:px-6"
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            height: "60px",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl md:hidden"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {portalLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite admin layout**

```tsx
// app/src/app/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { adminNavItems } from "@/lib/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <DashboardShell
      navItems={adminNavItems}
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

- [ ] **Step 3: Delete `sidebar-nav.tsx`**

```bash
git rm src/components/sidebar-nav.tsx
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: tsc clean; all unit tests pass.

- [ ] **Step 5: Visual smoke vs local DB** (dev server with `DATABASE_URL=postgresql://jly_admin:localdevpassword@localhost:5432/jly` override — NEVER Neon): admin pages render with sidebar, nav pill animates, mobile width shows hamburger + drawer.

- [ ] **Step 6: Commit**

```bash
git add -A src/components src/app/"(admin)"/layout.tsx
git commit -m "feat(shell): shared DashboardShell with mobile drawer; admin layout migrated"
```

---

### Task 7: Member layouts on the shell

**Files:**
- Modify: `app/src/app/me/layout.tsx`
- Modify: `app/src/app/ministry/layout.tsx`
- Delete: `app/src/components/member-shell.tsx`

- [ ] **Step 1: Rewrite `me/layout.tsx`**

```tsx
// app/src/app/me/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { memberNavForRole } from "@/lib/member-nav";
import type { Role } from "@/lib/authz";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "MEMBER") as Role;

  return (
    <DashboardShell
      navItems={memberNavForRole(role)}
      portalLabel="Member Portal"
      brandHref="/me"
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
    >
      {children}
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Rewrite `ministry/layout.tsx`** — identical except `portalLabel="Ministry Dashboard"`:

```tsx
// app/src/app/ministry/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { memberNavForRole } from "@/lib/member-nav";
import type { Role } from "@/lib/authz";

export default async function MinistryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "MEMBER") as Role;

  return (
    <DashboardShell
      navItems={memberNavForRole(role)}
      portalLabel="Ministry Dashboard"
      brandHref="/me"
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
    >
      {children}
    </DashboardShell>
  );
}
```

- [ ] **Step 3: Delete `member-shell.tsx`**

```bash
git rm src/components/member-shell.tsx
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/me/layout.tsx src/app/ministry/layout.tsx src/components
git commit -m "feat(me): member + ministry layouts use shared DashboardShell"
```

---

### Task 8: `/me` overview page (rewrite)

**Files:**
- Rewrite: `app/src/app/me/page.tsx`

Keeps: unlinked-profile message, `requireRole("MEMBER")`, heading **"Journey"** (E2E depends on it), stage chips via `JourneyLadder` (renders stage names — E2E checks "Regular Member"). Drops (moved to subpages): recent check-ins list, memberships list, join form/requests.

- [ ] **Step 1: Rewrite page**

```tsx
// app/src/app/me/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member, lifecycleStage } from "@/schema/membership";
import { person } from "@/schema/core";
import { requireRole } from "@/lib/authz-server";
import { nextStage, type StageRow } from "@/lib/journey";
import { greetingForHour, manilaHour } from "@/lib/greeting";
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import MotionCard from "@/components/motion-card";
import AnimatedNumber from "@/components/animated-number";
import JourneyLadder from "@/components/journey-ladder";

export default async function MePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({
      memberId: member.memberId,
      personId: member.personId,
      currentStage: member.currentStage,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .innerJoin(person, eq(member.personId, person.personId))
    .where(eq(users.email, email))
    .limit(1);

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My profile
        </h1>
        <p className="mt-4" style={{ color: "var(--text-secondary)" }}>
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

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

  const [attendanceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const [nextEvent] = await db
    .select({ eventId: event.eventId, name: event.name, startsAt: event.startsAt })
    .from(event)
    .where(
      and(
        gt(event.startsAt, sql`now()`),
        inArray(event.status, ["SCHEDULED", "IN_PROGRESS"] as ("SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED")[]),
      )
    )
    .orderBy(asc(event.startsAt))
    .limit(1);

  const next = nextStage(ladder, me.currentStage);
  const greeting = greetingForHour(manilaHour(new Date()));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {greeting}, {me.firstName}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          My christian journey
        </p>
      </MotionCard>

      {/* Journey */}
      <MotionCard delay={0.05} lift={false} className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Journey
        </h2>
        <JourneyLadder stages={visibleLadder} currentCode={me.currentStage} />
        {next ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Next step:{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {next.name}
            </span>
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            You are at the top of the ladder. Keep leading!
          </p>
        )}
      </MotionCard>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MotionCard delay={0.1} className="card-lime px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Total check-ins</p>
          <p className="stat-number mt-1 text-3xl">
            <AnimatedNumber value={attendanceStats.total} />
          </p>
        </MotionCard>
        <MotionCard delay={0.16} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            This year
          </p>
          <p className="stat-number mt-1 text-3xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={attendanceStats.thisYear} />
          </p>
        </MotionCard>
        <MotionCard delay={0.22} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Last attended
          </p>
          <p className="stat-number mt-1 text-lg leading-9" style={{ color: "var(--text-primary)" }}>
            {attendanceStats.lastAttended ?? "—"}
          </p>
        </MotionCard>
      </div>

      {/* Next event + quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MotionCard delay={0.28} className="card p-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Next event
          </h2>
          {nextEvent ? (
            <div className="mt-3">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {nextEvent.name}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(nextEvent.startsAt)}
              </p>
              <Link href="/church/calendar" className="mt-2 inline-block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                View calendar →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
              No upcoming events scheduled.
            </p>
          )}
        </MotionCard>
        <MotionCard delay={0.34} className="card p-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Quick actions
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/me/attendance" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                View my attendance →
              </Link>
            </li>
            <li>
              <Link href="/me/ministries" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                Manage my ministries →
              </Link>
            </li>
            <li>
              <Link href="/me/announcements" style={{ color: "var(--text-secondary)" }} className="font-medium hover:opacity-75">
                Read announcements →
              </Link>
            </li>
          </ul>
        </MotionCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: clean. Note: imports of `hasRole`, `joinRequest`, `ministryMembership`, etc. are gone — must not remain unused.

- [ ] **Step 3: Commit**

```bash
git add src/app/me/page.tsx
git commit -m "feat(me): overview page — greeting, animated journey ladder, stat cards"
```

---

### Task 9: `/me/attendance` page

**Files:**
- Create: `app/src/app/me/attendance/page.tsx`

- [ ] **Step 1: Create page**

```tsx
// app/src/app/me/attendance/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import { checkIn } from "@/schema/attendance";
import { event } from "@/schema/events";
import { requireRole } from "@/lib/authz-server";
import { desc, eq, sql } from "drizzle-orm";
import MotionCard from "@/components/motion-card";
import AnimatedNumber from "@/components/animated-number";

export default async function MyAttendancePage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({ personId: member.personId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p style={{ color: "var(--text-secondary)" }}>
          Your profile is not linked yet — please contact a church admin.
        </p>
      </div>
    );
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisYear: sql<number>`count(*) filter (where date_part('year', ${checkIn.checkedInAt}) = date_part('year', now()))::int`,
      lastAttended: sql<string | null>`to_char(max(${checkIn.checkedInAt}), 'YYYY-MM-DD')`,
    })
    .from(checkIn)
    .where(eq(checkIn.personId, me.personId));

  const recent = await db
    .select({
      checkInId: checkIn.checkInId,
      eventName: event.name,
      checkedInAt: checkIn.checkedInAt,
    })
    .from(checkIn)
    .innerJoin(event, eq(checkIn.eventId, event.eventId))
    .where(eq(checkIn.personId, me.personId))
    .orderBy(desc(checkIn.checkedInAt))
    .limit(25);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My attendance
        </h1>
      </MotionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MotionCard delay={0.05} className="card-lime px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Total</p>
          <p className="stat-number mt-1 text-3xl">
            <AnimatedNumber value={stats.total} />
          </p>
        </MotionCard>
        <MotionCard delay={0.11} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            This year
          </p>
          <p className="stat-number mt-1 text-3xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={stats.thisYear} />
          </p>
        </MotionCard>
        <MotionCard delay={0.17} className="card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Last attended
          </p>
          <p className="stat-number mt-1 text-lg leading-9" style={{ color: "var(--text-primary)" }}>
            {stats.lastAttended ?? "—"}
          </p>
        </MotionCard>
      </div>

      <MotionCard delay={0.23} lift={false} className="card p-6">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Recent check-ins
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            No attendance recorded yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.map((c) => (
              <li key={c.checkInId} className="flex items-center justify-between py-2 text-sm">
                <span style={{ color: "var(--text-primary)" }}>{c.eventName}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {c.checkedInAt.toISOString().split("T")[0]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </MotionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/me/attendance/page.tsx
git commit -m "feat(me): personal attendance page with animated stats"
```

---

### Task 10: `/me/ministries` page

**Files:**
- Create: `app/src/app/me/ministries/page.tsx`

Moves memberships + join requests + join form from the old `/me` page, restyled with motion. Server action `requestJoin` unchanged.

- [ ] **Step 1: Create page**

```tsx
// app/src/app/me/ministries/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { member } from "@/schema/membership";
import {
  joinRequest,
  ministryMembership,
  ministryChapter,
  ministry,
} from "@/schema/ministries";
import { requireRole } from "@/lib/authz-server";
import { nextFreePriority } from "@/lib/journey";
import { requestJoin } from "@/actions/join-requests";
import { listActiveHeads } from "@/actions/account";
import { and, asc, eq, isNull } from "drizzle-orm";
import MotionCard from "@/components/motion-card";

export default async function MyMinistriesPage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [me] = await db
    .select({ memberId: member.memberId })
    .from(users)
    .innerJoin(member, eq(users.personId, member.personId))
    .where(eq(users.email, email))
    .limit(1);

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p style={{ color: "var(--text-secondary)" }}>
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
    .innerJoin(ministryChapter, eq(ministryMembership.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(and(eq(ministryMembership.memberId, me.memberId), isNull(ministryMembership.endedAt)));

  const requests = await db
    .select({
      requestId: joinRequest.requestId,
      priority: joinRequest.priority,
      status: joinRequest.status,
      ministryName: ministry.name,
    })
    .from(joinRequest)
    .innerJoin(ministryChapter, eq(joinRequest.chapterId, ministryChapter.chapterId))
    .innerJoin(ministry, eq(ministryChapter.ministryId, ministry.ministryId))
    .where(eq(joinRequest.memberId, me.memberId))
    .orderBy(asc(joinRequest.priority));

  const heads = await listActiveHeads();
  const memberChapterIds = new Set(memberships.map((m) => m.chapterId));
  const taken = [
    ...memberships.map((m) => m.priority),
    ...requests.filter((r) => r.status === "PENDING").map((r) => r.priority),
  ].filter((p): p is number => p != null);
  const suggestedPriority = nextFreePriority(taken);
  const sortedMemberships = [...memberships].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  );
  const joinable = heads.filter((h) => !memberChapterIds.has(h.chapterId));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My ministries
        </h1>
      </MotionCard>

      <MotionCard delay={0.05} lift={false} className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Memberships
        </h2>
        {sortedMemberships.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No ministries yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {sortedMemberships.map((m) => (
              <li key={m.chapterId} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
                >
                  {m.priority ?? "—"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>{m.ministryName}</span>
              </li>
            ))}
          </ul>
        )}
      </MotionCard>

      <MotionCard delay={0.1} lift={false} className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Join a ministry
        </h2>

        {requests.length > 0 && (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {requests.map((r) => (
              <li key={r.requestId} className="flex items-center justify-between py-2 text-sm">
                <span style={{ color: "var(--text-primary)" }}>
                  #{r.priority} — {r.ministryName}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-300 ${
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

        {joinable.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No ministries available to join right now.
          </p>
        ) : (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          <form action={requestJoin as any} className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Ministry
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {joinable.map((h) => (
                  <option key={h.chapterId} value={h.chapterId}>
                    {h.ministryName} — {h.headFirstName} {h.headLastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
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
              className="btn-lime rounded-md px-4 py-2 text-sm font-medium"
            >
              Request to join
            </button>
          </form>
        )}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Requests are approved by the ministry head.
        </p>
      </MotionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: clean. If `btn-lime` doesn't exist in `globals.css` (check `grep -n "btn-lime" src/app/globals.css`), fall back to the original blue button classes from the old `/me` page.

- [ ] **Step 3: Commit**

```bash
git add src/app/me/ministries/page.tsx
git commit -m "feat(me): ministries page — memberships, join requests, join form"
```

---

### Task 11: `/me/announcements` page

**Files:**
- Create: `app/src/app/me/announcements/page.tsx`

Reads `communications.announcement_recipient` joined to `communications.announcement` for the logged-in person, `status = PUBLISHED`, newest first.

- [ ] **Step 1: Create page**

```tsx
// app/src/app/me/announcements/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { announcement, announcementRecipient } from "@/schema/communications";
import { requireRole } from "@/lib/authz-server";
import { formatAnnouncementDate } from "@/lib/member-announcements";
import { and, desc, eq } from "drizzle-orm";
import MotionCard from "@/components/motion-card";

export default async function MyAnnouncementsPage() {
  const session = await requireRole("MEMBER");
  const email = session.user!.email!;

  const [u] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const feed = !u?.personId
    ? []
    : await db
        .select({
          announcementId: announcement.announcementId,
          title: announcement.title,
          body: announcement.body,
          publishedAt: announcement.publishedAt,
        })
        .from(announcementRecipient)
        .innerJoin(
          announcement,
          eq(announcementRecipient.announcementId, announcement.announcementId)
        )
        .where(
          and(
            eq(announcementRecipient.personId, u.personId),
            eq(announcement.status, "PUBLISHED")
          )
        )
        .orderBy(desc(announcement.publishedAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6 md:px-4">
      <MotionCard lift={false}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Announcements
        </h1>
      </MotionCard>

      {feed.length === 0 ? (
        <MotionCard delay={0.05} lift={false} className="card p-6">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No announcements for you yet.
          </p>
        </MotionCard>
      ) : (
        feed.map((a, i) => (
          <MotionCard
            key={a.announcementId}
            delay={0.05 + Math.min(i, 8) * 0.06}
            className="card p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {a.title}
              </h2>
              <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {formatAnnouncementDate(a.publishedAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--text-secondary)" }}>
              {a.body}
            </p>
          </MotionCard>
        ))
      )}
    </div>
  );
}
```

Note: `users.personId` may be nullable in `@/schema/app` — the `!u?.personId` guard handles it. If tsc complains about the nullable `personId` inside the query, narrow first: `const pid = u?.personId; const feed = pid == null ? [] : await db...eq(announcementRecipient.personId, pid)...`.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/me/announcements/page.tsx
git commit -m "feat(me): read-only announcements feed for members"
```

---

### Task 12: E2E spec

**Files:**
- Create: `app/tests/e2e/member-dashboard.spec.ts`

Run only vs local DB (`docker compose up -d` in `db/`, env override per `playwright` harness — never Neon).

- [ ] **Step 1: Write spec** (login helper copied from `roles-journey.spec.ts` — repeat it, specs are standalone):

```ts
// app/tests/e2e/member-dashboard.spec.ts
import { test, expect } from "@playwright/test";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  waitFor: string | RegExp
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await page.waitForURL(waitFor, { timeout: 10000 });
  } catch {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(waitFor);
  }
}

async function signupMember(page: import("@playwright/test").Page) {
  const email = `e2e-shell-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"]', "Shell");
  await page.fill('input[name="lastName"]', "Member");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  const picker = page.locator('select[name="chapterId"]');
  if (await picker.isVisible().catch(() => false)) {
    await picker.selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/login/);
  await login(page, email, "password123", "/me");
  return email;
}

test.describe("Member dashboard shell", () => {
  test("member sees member nav, no admin link", async ({ page }) => {
    await signupMember(page);
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Attendance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Ministries" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Announcements" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Portal" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ministry Dashboard" })).toHaveCount(0);
  });

  test("member navigates between dashboard pages", async ({ page }) => {
    await signupMember(page);
    await page.getByRole("link", { name: "My Attendance" }).click();
    await page.waitForURL("/me/attendance");
    await expect(page.getByRole("heading", { name: "My attendance" })).toBeVisible();

    await page.getByRole("link", { name: "My Ministries" }).click();
    await page.waitForURL("/me/ministries");
    await expect(page.getByRole("heading", { name: "My ministries" })).toBeVisible();

    await page.getByRole("link", { name: "Announcements" }).click();
    await page.waitForURL("/me/announcements");
    await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  });

  test("overview keeps journey ladder", async ({ page }) => {
    await signupMember(page);
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    await expect(page.getByText("Regular Member").first()).toBeVisible();
  });

  test("admin still sees admin portal sidebar", async ({ page }) => {
    await login(page, "admin@jly.church", "changeme", "/members");
    await expect(page.getByRole("link", { name: "Members", exact: true })).toBeVisible();
    await expect(page.getByText("Admin Portal")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E vs local DB**

```bash
# repo root: cd db && docker compose up -d   (if not already running)
cd app && npx playwright test tests/e2e/member-dashboard.spec.ts
```

Expected: 4 tests PASS. Also run `npx playwright test tests/e2e/roles-journey.spec.ts` — must still pass (overview kept "Journey" heading).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/member-dashboard.spec.ts
git commit -m "test(e2e): member dashboard shell navigation"
```

---

### Task 13: Final verification gates

- [ ] **Step 1: Full unit suite**

```bash
npx vitest run
```

Expected: all pass (278 existing + 13 new ≈ 291).

- [ ] **Step 2: Type check + prod build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both clean.

- [ ] **Step 3: Full E2E vs local DB** (at minimum: `member-dashboard`, `roles-journey`, `admin-smoke`)

```bash
npx playwright test tests/e2e/member-dashboard.spec.ts tests/e2e/roles-journey.spec.ts tests/e2e/admin-smoke.spec.ts
```

Expected: pass (modulo pre-existing known-flaky skips).

- [ ] **Step 4: Visual check** (dev server vs local DB): member login → sidebar, drawer on mobile width, count-up stats, ladder fill, nav pill animation; admin pages unchanged visually except responsive sidebar.

- [ ] **Step 5: Update `CLAUDE.md` Current Progress** with one bullet describing this feature + commit.

```bash
git add ../CLAUDE.md
git commit -m "docs: record member dashboard redesign in project handoff"
```

- [ ] **Step 6: Push branch, open PR to master**

```bash
git push -u origin member-dashboard-redesign
gh pr create --title "feat(me): member dashboard redesign — shared shell + framer-motion" --body "Implements docs/superpowers/specs/2026-06-11-member-dashboard-redesign-design.md"
```
