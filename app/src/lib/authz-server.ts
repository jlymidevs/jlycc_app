// app/src/lib/authz-server.ts
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasRole, type Role } from "@/lib/authz";

/**
 * Server-side guard for pages and actions. Redirects when the session
 * is missing or under-privileged. Returns the session for convenience.
 */
export async function requireRole(required: Role) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) redirect("/login");
  if (!role || !hasRole(role, required)) redirect("/me");
  return session;
}
