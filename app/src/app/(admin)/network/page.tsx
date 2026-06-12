// app/src/app/(admin)/network/page.tsx
// Network Head dashboard (early version) — networks with their ministries.
// Reached from the super-admin "All Dashboards" sidebar section; guarded by
// middleware (ADMIN+) until the NETWORK_HEAD role lands.
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { network, ministry } from "@/schema/ministries";
import { asc, eq } from "drizzle-orm";

export default async function NetworkDashboardPage() {
  const rows = await db
    .select({
      networkId: network.networkId,
      name: network.name,
      code: network.code,
      description: network.description,
      ministryName: ministry.name,
    })
    .from(network)
    .leftJoin(ministry, eq(ministry.networkId, network.networkId))
    .orderBy(asc(network.name), asc(ministry.name));

  const byNetwork = new Map<
    number,
    { name: string; code: string; description: string | null; ministries: string[] }
  >();
  for (const r of rows) {
    let bucket = byNetwork.get(r.networkId);
    if (!bucket) {
      bucket = { name: r.name, code: r.code, description: r.description, ministries: [] };
      byNetwork.set(r.networkId, bucket);
    }
    if (r.ministryName) bucket.ministries.push(r.ministryName);
  }
  const networks = Array.from(byNetwork.values());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Network Dashboard
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Networks and the ministries they oversee
        </p>
      </div>

      {networks.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            No networks yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Networks group related ministries under one head. Create them from the
            Ministries module.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {networks.map((n) => (
            <div
              key={n.code}
              className="rounded-2xl border p-5"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {n.name}
                </h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {n.code}
                </span>
              </div>
              {n.description && (
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  {n.description}
                </p>
              )}
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Ministries ({n.ministries.length})
              </p>
              {n.ministries.length === 0 ? (
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  None assigned
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {n.ministries.map((m) => (
                    <li key={m} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
