// app/src/schema/ministries.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  date,
  timestamp,
  pgSchema,
  unique,
} from "drizzle-orm/pg-core";
import { branch } from "./core";
import { member } from "./membership";

export const ministriesSchema = pgSchema("ministries");

export const chapterStatusEnum = ministriesSchema.enum("chapter_status", [
  "ACTIVE",
  "PAUSED",
  "CLOSED",
]);

export const leaderRoleEnum = ministriesSchema.enum("leader_role", [
  "HEAD",
  "ASSISTANT_HEAD",
  "COORDINATOR",
]);

export const network = ministriesSchema.table("network", {
  networkId: bigserial("network_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const ministry = ministriesSchema.table("ministry", {
  ministryId: bigserial("ministry_id", { mode: "number" }).primaryKey(),
  networkId: bigint("network_id", { mode: "number" })
    .notNull()
    .references(() => network.networkId),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  targetDemographic: text("target_demographic"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const ministryChapter = ministriesSchema.table(
  "ministry_chapter",
  {
    chapterId: bigserial("chapter_id", { mode: "number" }).primaryKey(),
    ministryId: bigint("ministry_id", { mode: "number" })
      .notNull()
      .references(() => ministry.ministryId),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => branch.branchId),
    launchedOn: date("launched_on"),
    status: chapterStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
  },
  (t) => [unique("chapter_ministry_branch_unique").on(t.ministryId, t.branchId)]
);

export const ministryMembership = ministriesSchema.table("ministry_membership", {
  membershipId: bigserial("membership_id", { mode: "number" }).primaryKey(),
  chapterId: bigint("chapter_id", { mode: "number" })
    .notNull()
    .references(() => ministryChapter.chapterId, { onDelete: "cascade" }),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedReason: text("ended_reason"),
  isLeader: boolean("is_leader").notNull().default(false),
  leaderRole: leaderRoleEnum("leader_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
