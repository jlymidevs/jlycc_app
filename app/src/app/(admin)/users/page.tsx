// app/src/app/(admin)/users/page.tsx
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { requireRole } from "@/lib/authz-server";
import { asc, ilike, isNotNull, isNull, and, eq, or } from "drizzle-orm";
import Link from "next/link";
import UserRoleControls from "@/components/user-role-controls";
import { ListSearch } from "@/components/members/list-search";
import {
  appointNetworkHead,
  networkHeadOverview,
  removeNetworkHead,
} from "@/actions/network-leaders";
import { getUserContext, getUserBasic } from "@/actions/users-context";

function fmtLogin(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
  });
}

const ordinal = (p: number | null) =>
  p == null ? "—" : p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : `${p}th`;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string; user?: string };
}) {
  const session = await requireRole("SUPER_ADMIN");
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const selectedPersonId = searchParams.user ? Number(searchParams.user) : null;

  const searchFilter =
    query.length > 0
      ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`))
      : undefined;

  const userCols = {
    userId: users.userId,
    email: users.email,
    name: users.name,
    role: users.role,
    personId: users.personId,
    isActive: users.isActive,
    lastLoginAt: users.lastLoginAt,
    archivedAt: users.archivedAt,
  };

  const [nh, activeRows, suspendedRows, archivedRows, modalCtx, modalUser] =
    await Promise.all([
      networkHeadOverview(),
      db
        .select(userCols)
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.archivedAt), searchFilter))
        .orderBy(asc(users.email)),
      db
        .select(userCols)
        .from(users)
        .where(and(eq(users.isActive, false), isNull(users.archivedAt), searchFilter))
        .orderBy(asc(users.email)),
      db
        .select(userCols)
        .from(users)
        .where(and(isNotNull(users.archivedAt), searchFilter))
        .orderBy(asc(users.email)),
      selectedPersonId ? getUserContext(selectedPersonId) : Promise.resolve(null),
      selectedPersonId ? getUserBasic(selectedPersonId) : Promise.resolve(null),
    ]);

  const closeHref = query ? `/users?q=${encodeURIComponent(query)}` : "/users";

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
              <th className="py-2 pr-4 font-medium">Last login</th>
              <th className="py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  {query ? `No active users match "${query}".` : "No active users."}
                </td>
              </tr>
            )}
            {activeRows.map((u) => (
              <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">
                  {u.personId != null ? (
                    <Link
                      href={`?user=${u.personId}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      className="underline decoration-dotted hover:decoration-solid"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {u.email}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--text-primary)" }}>{u.email}</span>
                  )}
                </td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.name ?? "—"}</td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{u.role}</td>
                <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-muted)" }}>
                  {fmtLogin(u.lastLoginAt)}
                </td>
                <td className="py-2">
                  <UserRoleControls
                    userId={u.userId}
                    role={u.role}
                    isActive={u.isActive}
                    hasProfile={u.personId != null}
                    isSelf={u.email === session.user?.email}
                    archivedAt={u.archivedAt}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suspended users */}
      {suspendedRows.length > 0 && (
        <details className="card p-0 overflow-hidden">
          <summary
            className="cursor-pointer select-none px-6 py-4 text-sm font-medium flex items-center justify-between"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>Suspended ({suspendedRows.length})</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="details-chevron">
              <path strokeLinecap="round" d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="overflow-x-auto px-6 pb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suspendedRows.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>{u.name ?? "—"}</td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>{u.role}</td>
                    <td className="py-2">
                      <UserRoleControls
                        userId={u.userId}
                        role={u.role}
                        isActive={false}
                        hasProfile={u.personId != null}
                        isSelf={u.email === session.user?.email}
                        archivedAt={null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Archived users */}
      {archivedRows.length > 0 && (
        <details className="card p-0 overflow-hidden">
          <summary
            className="cursor-pointer select-none px-6 py-4 text-sm font-medium flex items-center justify-between"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Archived ({archivedRows.length})</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="details-chevron">
              <path strokeLinecap="round" d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="overflow-x-auto px-6 pb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Archived</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedRows.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>{u.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      {fmtLogin(u.archivedAt)}
                    </td>
                    <td className="py-2">
                      <UserRoleControls
                        userId={u.userId}
                        role={u.role}
                        isActive={false}
                        hasProfile={u.personId != null}
                        isSelf={u.email === session.user?.email}
                        archivedAt={u.archivedAt}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

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

      {/* User context modal */}
      {selectedPersonId && modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <Link href={closeHref} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} aria-label="Close" />

          {/* Card */}
          <div
            className="relative z-10 w-full max-w-lg rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                  {modalUser.name ?? modalUser.email}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{modalUser.email}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--bg-inset)", color: "var(--text-secondary)" }}
                  >
                    {modalUser.role}
                  </span>
                  {modalCtx?.stageName && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
                    >
                      {modalCtx.stageName}
                    </span>
                  )}
                  {!modalCtx?.stageName && (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      No member profile
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={closeHref}
                className="shrink-0 rounded-lg p-1 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </Link>
            </div>

            {modalCtx && (
              <>
                {/* Network headships */}
                <section className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Network Head
                  </p>
                  {modalCtx.networkHeadships.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>—</p>
                  ) : (
                    <ul className="space-y-1">
                      {modalCtx.networkHeadships.map((n) => (
                        <li
                          key={n.networkId}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--bg-inset)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                            <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
                            <path strokeLinecap="round" d="M12 8v4m0 0l-5 4.5M12 12l5 4.5" />
                          </svg>
                          <span style={{ color: "var(--text-primary)" }}>{n.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Chapter headships */}
                <section className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Ministry Head
                  </p>
                  {modalCtx.chapterHeadships.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>—</p>
                  ) : (
                    <ul className="space-y-1">
                      {modalCtx.chapterHeadships.map((h, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--bg-inset)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                          </svg>
                          <span style={{ color: "var(--text-secondary)" }}>{h.ministryName}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                            <path strokeLinecap="round" d="M9 18l6-6-6-6" />
                          </svg>
                          <span style={{ color: "var(--text-primary)" }}>{h.branchName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Ministry memberships */}
                <section className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Ministry Memberships
                  </p>
                  {modalCtx.memberships.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not in any ministry</p>
                  ) : (
                    <ul className="space-y-1">
                      {modalCtx.memberships.map((m) => (
                        <li
                          key={m.membershipId}
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--bg-inset)" }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <span style={{ color: "var(--text-secondary)" }} className="truncate">{m.ministryName}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                                <path strokeLinecap="round" d="M9 18l6-6-6-6" />
                              </svg>
                              <span style={{ color: "var(--text-primary)" }} className="truncate">{m.branchName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {m.isLeader && (
                                <span
                                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                                  style={{ background: "var(--lime-soft)", color: "var(--text-primary)" }}
                                >
                                  HEAD
                                </span>
                              )}
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {ordinal(m.priority)} priority
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
