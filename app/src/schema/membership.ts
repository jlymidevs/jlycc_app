// app/src/schema/membership.ts
import {
  bigserial,
  bigint,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";

export const membershipSchema = pgSchema("membership");

export const memberStatusEnum = membershipSchema.enum("member_status", [
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "DECEASED",
]);
export const pcmStatusEnum = membershipSchema.enum("pcm_status", [
  "ACTIVE",
  "ENDED",
  "REASSIGNED",
]);

export const lifecycleStage = membershipSchema.table("lifecycle_stage", {
  stageCode: text("stage_code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  isTerminal: boolean("is_terminal").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const role = membershipSchema.table("role", {
  roleId: bigserial("role_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isPastoral: boolean("is_pastoral").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const member = membershipSchema.table("member", {
  memberId: bigserial("member_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => person.personId),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  memberCode: text("member_code").notNull().unique(),
  currentStage: text("current_stage")
    .notNull()
    .references(() => lifecycleStage.stageCode),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  regularMemberSince: timestamp("regular_member_since", {
    withTimezone: true,
  }),
  status: memberStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const memberRole = membershipSchema.table("member_role", {
  memberRoleId: bigserial("member_role_id", { mode: "number" }).primaryKey(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => member.memberId),
  roleId: bigint("role_id", { mode: "number" })
    .notNull()
    .references(() => role.roleId),
  branchId: bigint("branch_id", { mode: "number" }),
  regionId: bigint("region_id", { mode: "number" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  assignedByPersonId: bigint("assigned_by_person_id", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const pastoralCareAssignment = membershipSchema.table(
  "pastoral_care_assignment",
  {
    assignmentId: bigserial("assignment_id", { mode: "number" }).primaryKey(),
    carerMemberId: bigint("carer_member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId),
    assignedMemberId: bigint("assigned_member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: pcmStatusEnum("status").notNull().default("ACTIVE"),
    notes: text("notes"),
  }
);
