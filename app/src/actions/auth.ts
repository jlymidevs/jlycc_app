// app/src/actions/auth.ts
"use server";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

/** Post-login landing page by role (spec: ADMIN+ → /members, head → /ministry, member → /me). */
function destinationFor(role: string | undefined): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/members";
  if (role === "MINISTRY_HEAD") return "/ministry";
  return "/me";
}

export async function loginAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.toLowerCase().trim();
  await signIn("credentials", {
    email,
    password: formData.get("password"),
    redirect: false,
  });
  // The session cookie set by signIn isn't readable within this same
  // request, so resolve the landing page from the DB directly.
  let role: string | undefined;
  if (email) {
    const [u] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    role = u?.role;
  }
  redirect(destinationFor(role));
}

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/members" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
