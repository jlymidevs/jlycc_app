import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";

const navItems = [
  {
    href: "/members",
    label: "Members",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    href: "/members/applications",
    label: "Applications",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path strokeLinecap="round" d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    href: "/events/attendance",
    label: "Attendance",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3L22 4"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
  {
    href: "/programs/heartlink",
    label: "Programs",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    href: "/education/bc/students",
    label: "Education",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0122 21H2a12.083 12.083 0 013.84-10.422L12 14z"/>
      </svg>
    ),
  },
  {
    href: "/ministries",
    label: "Ministries",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
      </svg>
    ),
  },
  {
    href: "/missions/scholarships",
    label: "Missions",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"/>
        <circle cx="12" cy="11" r="3"/>
      </svg>
    ),
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
  },
];

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
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col items-center py-4 gap-2 shrink-0"
        style={{
          width: "var(--sidebar-width)",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <Link href="/members" className="mb-3 flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="JLYCC" width={40} height={40} />
        </Link>

        {/* Nav */}
        <nav className="flex flex-col gap-1 w-full px-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="group relative flex items-center justify-center w-full h-11 rounded-xl transition-all"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="group-hover:text-white transition-colors"
                style={{ color: "inherit" }}>
                {item.icon}
              </span>
              {/* Tooltip */}
              <span
                className="absolute left-full ml-3 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Avatar + sign out */}
        <form action={logoutAction} className="flex flex-col items-center gap-1 mt-auto">
          <button
            type="submit"
            title={`Sign out (${session.user?.email})`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-75"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {initials}
          </button>
        </form>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            height: "60px",
          }}
        >
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            Admin
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {session.user?.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
