// app/src/middleware.ts
// Edge-safe role guards: decode the session JWT directly (no DB, no
// next-auth callbacks — the postgres driver cannot run on the edge).
// NOTE: must live in src/ — Next.js ignores middleware.ts at the project
// root when a src/ directory exists.
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

function rank(role: unknown): number {
  return typeof role === "string" && role in ROLE_RANK ? ROLE_RANK[role] : -1;
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isAdminRoute = ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/")
  );
  const isUsersRoute = path === "/users" || path.startsWith("/users/");
  const isMinistryRoute = path === "/ministry" || path.startsWith("/ministry/");
  const isMeRoute =
    path === "/me" ||
    path.startsWith("/me/") ||
    path === "/welcome" ||
    path.startsWith("/welcome/");

  if (!(isAdminRoute || isUsersRoute || isMinistryRoute || isMeRoute)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const role = token.role;

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
  return NextResponse.next();
}

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
    "/welcome/:path*",
  ],
};
