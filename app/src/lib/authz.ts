// app/src/lib/authz.ts
// Pure role-hierarchy helpers (no next-auth import — safe for vitest).
// Server-side guard `requireRole` lives in authz-server.ts.

export const ROLES = ["MEMBER", "MINISTRY_HEAD", "NETWORK_HEAD", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** True when `actual` is at least as privileged as `required`. */
export function hasRole(actual: Role, required: Role): boolean {
  const a = ROLES.indexOf(actual);
  const r = ROLES.indexOf(required);
  return a >= 0 && r >= 0 && a >= r;
}
