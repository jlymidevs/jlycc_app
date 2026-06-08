// app/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute =
    path.startsWith("/members") || path.startsWith("/events");
  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/members", "/members/:path*", "/events", "/events/:path*"],
};
