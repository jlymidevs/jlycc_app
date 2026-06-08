// app/src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as core from "@/schema/core";
import * as membership from "@/schema/membership";
import * as app from "@/schema/app";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch for transactions
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, {
  schema: { ...core, ...membership, ...app },
});
