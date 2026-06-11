// app/src/app/(admin)/users/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { asc } from "drizzle-orm";
import UserRoleControls from "@/components/user-role-controls";

export default async function UsersPage() {
  const session = await requireRole("SUPER_ADMIN");

  const rows = await db
    .select({
      userId: users.userId,
      email: users.email,
      name: users.name,
      role: users.role,
      personId: users.personId,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-6 md:px-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Users
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Accounts, roles, and access
        </p>
      </div>

      <div className="card overflow-x-auto p-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{u.email}</td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.name ?? "—"}</td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.role}</td>
                <td className="py-2 pr-4">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      u.isActive
                        ? { background: "var(--lime-soft)", color: "var(--text-primary)" }
                        : { background: "var(--bg-inset)", color: "var(--text-muted)" }
                    }
                  >
                    {u.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td className="py-2">
                  <UserRoleControls
                    userId={u.userId}
                    role={u.role}
                    isActive={u.isActive}
                    hasProfile={u.personId != null}
                    isSelf={u.email === session.user?.email}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
