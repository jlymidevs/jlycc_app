// app/src/actions/users.ts
"use server";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { ROLES, type Role } from "@/lib/authz";
import { requireRole } from "@/lib/authz-server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { provisionMemberProfile } from "@/lib/provision";

export async function changeUserRole(userId: string, role: string) {
  const session = await requireRole("SUPER_ADMIN");
  if (!ROLES.includes(role as Role)) {
    return { errors: { role: ["Invalid role"] } };
  }
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { role: ["User not found"] } };
  if (target.email === session.user?.email) {
    return { errors: { role: ["You cannot change your own role"] } };
  }
  await db.update(users).set({ role }).where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { active: ["User not found"] } };
  if (target.email === session.user?.email) {
    return { errors: { active: ["You cannot deactivate yourself"] } };
  }
  await db.update(users).set({ isActive }).where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function archiveUser(userId: string) {
  const session = await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { user: ["User not found"] } };
  if (target.email === session.user?.email) {
    return { errors: { user: ["You cannot archive yourself"] } };
  }
  await db
    .update(users)
    .set({ isActive: false, archivedAt: new Date() })
    .where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function reactivateUser(userId: string) {
  await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { user: ["User not found"] } };
  await db
    .update(users)
    .set({ isActive: true, archivedAt: null })
    .where(eq(users.userId, userId));
  revalidatePath("/users");
  return { ok: true };
}

/** Provision (or re-link) the member profile for a legacy user. */
export async function provisionUserProfile(userId: string) {
  await requireRole("SUPER_ADMIN");
  const [target] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  if (!target) return { errors: { user: ["User not found"] } };
  const fullName = target.name ?? target.email;
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.slice(0, -1).join(" ") || parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "—";
  await provisionMemberProfile(userId, target.email, firstName, lastName);
  revalidatePath("/users");
  return { ok: true };
}
