import type { Role } from "@/lib/authz";

export function canDeleteMinistries(role: Role): boolean {
  return role === "SUPER_ADMIN";
}
