import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import ThemeToggle from "@/components/theme-toggle";

// Shared chrome for member-facing pages (/me, /ministry) so they match
// the admin dashboard: same surfaces, topbar, theme toggle, branding.
export default function MemberShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <header
        className="sticky top-0 z-20 flex shrink-0 items-center justify-between px-6"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          height: "60px",
        }}
      >
        <Link href="/me" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jlycc-logo.png" alt="JLYCC" width={34} height={34} style={{ objectFit: "contain" }} />
          <span className="font-display text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            JLYCC
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/church/calendar"
            className="text-sm font-medium transition-colors hover:opacity-75"
            style={{ color: "var(--text-secondary)" }}
          >
            Calendar
          </Link>
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
