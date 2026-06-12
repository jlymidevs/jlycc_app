// app/src/components/dashboard-shell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
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
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Focus management: move focus into drawer on open, return to hamburger on close.
  useEffect(() => {
    if (drawerOpen) {
      drawerRef.current?.focus();
    } else {
      hamburgerRef.current?.focus();
    }
  }, [drawerOpen]);

  // Escape key closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

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

  const renderNav = (group: "desktop" | "drawer") => (
    <LayoutGroup id={group}>
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
                  layoutId={`nav-pill-${group}`}
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
    </LayoutGroup>
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
        {renderNav("desktop")}
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
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col py-5 md:hidden"
              style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
              initial={reduced ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              {brand}
              {renderNav("drawer")}
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
              ref={hamburgerRef}
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
