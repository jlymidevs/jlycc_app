// app/src/schema/programs.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";

export const programsSchema = pgSchema("programs");

export const cohortStatusEnum = programsSchema.enum("cohort_status", [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const enrollmentStatusEnum = programsSchema.enum("enrollment_status", [
  "ENROLLED",
  "ACTIVE",
  "COMPLETED",
  "DROPPED",
]);

export const heartlinkCohort = programsSchema.table("heartlink_cohort", {
  cohortId: bigserial("cohort_id", { mode: "number" }).primaryKey(),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  sessionCount: integer("session_count"),
  facilitatorMemberId: bigint("facilitator_member_id", { mode: "number" }).references(
    () => member.memberId
  ),
  status: cohortStatusEnum("status").notNull().default("PLANNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const heartlinkEnrollment = programsSchema.table("heartlink_enrollment", {
  enrollmentId: bigserial("enrollment_id", { mode: "number" }).primaryKey(),
  cohortId: bigint("cohort_id", { mode: "number" })
    .notNull()
    .references(() => heartlinkCohort.cohortId, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  status: enrollmentStatusEnum("status").notNull().default("ENROLLED"),
  completionDate: date("completion_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
  // UNIQUE(cohort_id, person_id) enforced at DB level
});

export const heartlinkSession = programsSchema.table("heartlink_session", {
  sessionId: bigserial("session_id", { mode: "number" }).primaryKey(),
  cohortId: bigint("cohort_id", { mode: "number" })
    .notNull()
    .references(() => heartlinkCohort.cohortId, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  topic: text("topic"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  facilitatorMemberId: bigint("facilitator_member_id", { mode: "number" }).references(
    () => member.memberId
  ),
  venue: text("venue"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const heartlinkSessionAttendance = programsSchema.table("heartlink_session_attendance", {
  attendanceId: bigserial("attendance_id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" })
    .notNull()
    .references(() => heartlinkSession.sessionId, { onDelete: "cascade" }),
  enrollmentId: bigint("enrollment_id", { mode: "number" })
    .notNull()
    .references(() => heartlinkEnrollment.enrollmentId, { onDelete: "cascade" }),
  attended: boolean("attended").notNull(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // UNIQUE(session_id, enrollment_id) enforced at DB level
});
