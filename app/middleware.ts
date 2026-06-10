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
