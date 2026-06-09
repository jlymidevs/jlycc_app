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
];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/")
  );
  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
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
  ],
};
