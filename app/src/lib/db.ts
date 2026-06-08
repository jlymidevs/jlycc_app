// app/src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// @ts-ignore
import * as core from "@/schema/core";
// @ts-ignore
import * as membership from "@/schema/membership";
// @ts-ignore
import * as app from "@/schema/app";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch for transactions
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, {
  schema: { ...core, ...membership, ...app },
});
