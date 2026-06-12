// app/src/schema/app.ts
import {
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";
import { person } from "./core";

export const appSchema = pgSchema("app");

export const users = appSchema.table("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("MEMBER"),
  personId: bigint("person_id", { mode: "number" })
    .unique()
    .references(() => person.personId),
  isActive: boolean("is_active").notNull().default(true),
  profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
