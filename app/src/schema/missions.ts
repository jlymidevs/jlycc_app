// app/src/schema/missions.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  numeric,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";

export const missionsSchema = pgSchema("missions");

export const initiativeStatusEnum = missionsSchema.enum("initiative_status", [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const bacRoleEnum = missionsSchema.enum("bac_role", [
  "LEADER",
  "FACILITATOR",
  "PARTICIPANT",
  "VOLUNTEER",
]);

export const attendanceRoleEnum = missionsSchema.enum("attendance_role", [
  "ENROLLED",
  "WALK_IN",
  "FACILITATOR",
]);

export const bacInitiative = missionsSchema.table("bac_initiative", {
  initiativeId: bigserial("initiative_id", { mode: "number" }).primaryKey(),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  name: text("name").notNull(),
  targetCommunity: text("target_community"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  coordinatorMemberId: bigint("coordinator_member_id", { mode: "number" }).references(
    () => member.memberId
  ),
  status: initiativeStatusEnum("status").notNull().default("PLANNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bacSession = missionsSchema.table("bac_session", {
  sessionId: bigserial("session_id", { mode: "number" }).primaryKey(),
  initiativeId: bigint("initiative_id", { mode: "number" })
    .notNull()
    .references(() => bacInitiative.initiativeId, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  topic: text("topic"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  venue: text("venue"),
  facilitatorMemberId: bigint("facilitator_member_id", { mode: "number" }).references(
    () => member.memberId
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bacParticipant = missionsSchema.table("bac_participant", {
  participantId: bigserial("participant_id", { mode: "number" }).primaryKey(),
  initiativeId: bigint("initiative_id", { mode: "number" })
    .notNull()
    .references(() => bacInitiative.initiativeId, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  role: bacRoleEnum("role").notNull().default("PARTICIPANT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bacSessionAttendance = missionsSchema.table("bac_session_attendance", {
  attendanceId: bigserial("attendance_id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" })
    .notNull()
    .references(() => bacSession.sessionId, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  attended: boolean("attended").notNull(),
  attendedAs: attendanceRoleEnum("attended_as").notNull().default("ENROLLED"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // UNIQUE(session_id, person_id) enforced at DB level
});

// --- Scholar / Scholarship tables (V046) ---

export const programStatusEnum = missionsSchema.enum("program_status", [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const awardStatusEnum = missionsSchema.enum("award_status", [
  "AWARDED",
  "ACTIVE",
  "COMPLETED",
  "REVOKED",
]);

export const scholarProgram = missionsSchema.table("scholar_program", {
  programId: bigserial("program_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  description: text("description"),
  status: programStatusEnum("status").notNull().default("PLANNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const scholarshipAward = missionsSchema.table("scholarship_award", {
  awardId: bigserial("award_id", { mode: "number" }).primaryKey(),
  programId: bigint("program_id", { mode: "number" }).notNull().references(() => scholarProgram.programId),
  memberId: bigint("member_id", { mode: "number" }).notNull().references(() => member.memberId),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  term: text("term"),
  amount: numeric("amount"),
  schoolName: text("school_name"),
  sponsorMemberId: bigint("sponsor_member_id", { mode: "number" }).references(() => member.memberId),
  status: awardStatusEnum("status").notNull().default("AWARDED"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
