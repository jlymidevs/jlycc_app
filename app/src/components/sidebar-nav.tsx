"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  {
    href: "/members",
    label: "Members",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/members/applications",
    label: "Applications",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path strokeLinecap="round" d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/events/attendance",
    label: "Attendance",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3L22 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/programs/heartlink",
    label: "Programs",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: "/education/bc/students",
    label: "Education",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0122 21H2a12.083 12.083 0 013.84-10.422L12 14z" />
      </svg>
    ),
  },
  {
    href: "/ministries",
    label: "Ministries",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
      </svg>
    ),
  },
  {
    href: "/missions/scholarships",
    label: "Missions",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z" />
        <circle cx="12" cy="11" r="3" />
      </svg>
    ),
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/ghl",
    label: "GHL Sync",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  // Longest-prefix match so /members/applications doesn't also light up /members
  const active = navItems.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(item.href + "/");
    if (!matches) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);

  return (
    <nav className="flex w-full flex-1 flex-col gap-1 px-3">
      {navItems.map((item, i) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="reveal group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200"
            style={{
              animationDelay: `${0.03 * i}s`,
              background: isActive ? "var(--sidebar-active-bg)" : "transparent",
              color: isActive ? "var(--sidebar-icon-active)" : "var(--sidebar-icon)",
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {!isActive && (
              <span
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: "var(--bg-card-hover)" }}
              />
            )}
            <span
              className="relative shrink-0 transition-transform duration-200 group-hover:scale-110"
              style={{ color: "inherit" }}
            >
              {item.icon}
            </span>
            <span className="relative truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
