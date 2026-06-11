// app/src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as core from "@/schema/core";
import * as membership from "@/schema/membership";
import * as app from "@/schema/app";

const connectionString = process.env.DATABASE_URL!;

// Reuse one client across dev HMR recompiles — otherwise every reload
// opens a fresh pool and Postgres runs out of connections.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

// Disable prefetch for transactions
const client =
  globalForDb.pgClient ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, {
  schema: { ...core, ...membership, ...app },
});
