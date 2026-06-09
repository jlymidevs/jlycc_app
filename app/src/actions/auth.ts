// app/src/actions/auth.ts
"use server";

import { signIn, signOut } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/members",
  });
}

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/members" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
