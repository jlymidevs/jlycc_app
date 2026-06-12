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
    href: "/me/calendar",
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
