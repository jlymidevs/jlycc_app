import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import SidebarNav from "@/components/sidebar-nav";
import ThemeToggle from "@/components/theme-toggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const initials = (session.user?.name ?? session.user?.email ?? "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative z-10 flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside
        className="flex shrink-0 flex-col py-5"
        style={{
          width: "var(--sidebar-width)",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <Link href="/members" className="mb-6 flex items-center gap-3 px-5">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="JLYCC" width={36} height={36} />
          </span>
          <span
            className="font-display text-lg font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            JLYCC
          </span>
        </Link>

        <SidebarNav />

        {/* User */}
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
              {session.user?.name ?? "Staff"}
            </p>
            <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
              {session.user?.email}
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
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="flex shrink-0 items-center justify-between px-6"
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            height: "60px",
          }}
        >
          <span className="font-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Admin Portal
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
