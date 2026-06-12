// app/src/app/(admin)/users/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { asc, ilike, or } from "drizzle-orm";
import UserRoleControls from "@/components/user-role-controls";
import { ListSearch } from "@/components/members/list-search";
import {
  appointNetworkHead,
  networkHeadOverview,
  removeNetworkHead,
} from "@/actions/network-leaders";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await requireRole("SUPER_ADMIN");
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const [nh, rows] = await Promise.all([
    networkHeadOverview(),
    db
      .select({
        userId: users.userId,
        email: users.email,
        name: users.name,
        role: users.role,
        personId: users.personId,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        query.length > 0
          ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`))
          : undefined
      )
      .orderBy(asc(users.email)),
  ]);

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

      <ListSearch
        action="/users"
        defaultValue={query}
        placeholder="Search by email or name…"
        variant="lime"
      />

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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  {query ? `No users match "${query}".` : "No users."}
                </td>
              </tr>
            )}
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

      <div className="card overflow-x-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Network Heads
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            One head per network. Network heads appoint ministry heads.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-4 font-medium">Network</th>
              <th className="py-2 pr-4 font-medium">Current head</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {nh.networks.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  No networks found.
                </td>
              </tr>
            )}
            {nh.networks.map((n) => {
              const head = nh.heads.find((h) => h.networkId === n.networkId);
              return (
                <tr key={n.networkId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{n.name}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {head ? `${head.firstName} ${head.lastName}` : "—"}
                  </td>
                  <td className="py-2">
                    {head ? (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      <form action={removeNetworkHead as any}>
                        <input type="hidden" name="leaderId" value={head.leaderId} />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline">
                          Remove
                        </button>
                      </form>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      <form action={appointNetworkHead as any} className="flex items-center gap-2">
                        <input type="hidden" name="networkId" value={n.networkId} />
                        <select
                          name="memberId"
                          className="rounded-md px-2 py-1 text-sm"
                          style={{
                            background: "var(--bg-inset)",
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {nh.candidates.map((c) => (
                            <option key={c.memberId} value={c.memberId}>
                              {c.firstName} {c.lastName} ({c.email})
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="text-xs underline"
                          style={{ color: "var(--text-primary)" }}
                        >
                          Appoint
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
