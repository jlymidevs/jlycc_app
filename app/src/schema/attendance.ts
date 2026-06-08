// app/src/schema/attendance.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  pgSchema,
  primaryKey,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";
import { event } from "./events";

export const attendanceSchema = pgSchema("attendance");

export const checkInMethodEnum = attendanceSchema.enum("check_in_method", [
  "SELF",
  "USHER",
  "BULK_IMPORT",
]);

export const checkIn = attendanceSchema.table(
  "check_in",
  {
    checkInId: bigserial("check_in_id", { mode: "number" }).notNull(),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => event.eventId),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => person.personId),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => branch.branchId),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull(),
    checkInMethod: checkInMethodEnum("check_in_method")
      .notNull()
      .default("USHER"),
    capturedByMemberId: bigint("captured_by_member_id", {
      mode: "number",
    }).references(() => member.memberId),
    ftvCaptureId: bigint("ftv_capture_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.checkInId, t.checkedInAt] })]
);

export const visitorCapture = attendanceSchema.table("visitor_capture", {
  ftvCaptureId: bigserial("ftv_capture_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  eventId: bigint("event_id", { mode: "number" })
    .notNull()
    .references(() => event.eventId),
  branchId: bigint("branch_id", { mode: "number" })
    .notNull()
    .references(() => branch.branchId),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  capturedByMemberId: bigint("captured_by_member_id", {
    mode: "number",
  }).references(() => member.memberId),
  invitedByPersonId: bigint("invited_by_person_id", {
    mode: "number",
  }).references(() => person.personId),
  consentToContact: boolean("consent_to_contact").notNull().default(false),
  intakeNotes: text("intake_notes"),
  convertedMemberId: bigint("converted_member_id", {
    mode: "number",
  }).references(() => member.memberId),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
