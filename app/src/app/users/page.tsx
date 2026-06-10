// app/src/app/users/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Link href="/me" className="text-sm text-blue-600 hover:text-blue-800">
          My profile
        </Link>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.userId} className="border-b border-gray-100">
              <td className="py-2 pr-4 text-gray-900">{u.email}</td>
              <td className="py-2 pr-4 text-gray-600">{u.name ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-600">{u.role}</td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
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
  );
}
