// app/src/schema/events.ts
import {
  bigserial,
  bigint,
  text,
  timestamp,
  integer,
  date,
  jsonb,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";

export const eventsSchema = pgSchema("events");

export const eventStatusEnum = eventsSchema.enum("event_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const registrationStatusEnum = eventsSchema.enum("registration_status", [
  "REGISTERED",
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
  "NO_SHOW",
]);

export const recurrencePatternEnum = eventsSchema.enum("recurrence_pattern", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const seriesStatusEnum = eventsSchema.enum("series_status", [
  "ACTIVE",
  "PAUSED",
  "ENDED",
]);

export const eventType = eventsSchema.table("event_type", {
  eventTypeId: bigserial("event_type_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryCode: text("category_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventSeries = eventsSchema.table("event_series", {
  seriesId: bigserial("series_id", { mode: "number" }).primaryKey(),
  eventTypeId: bigint("event_type_id", { mode: "number" })
    .notNull()
    .references(() => eventType.eventTypeId),
  branchId: bigint("branch_id", { mode: "number" }).references(
    () => branch.branchId
  ),
  name: text("name").notNull(),
  recurrencePattern: recurrencePatternEnum("recurrence_pattern").notNull(),
  recurrenceConfig: jsonb("recurrence_config").notNull().default({}),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  status: seriesStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const event = eventsSchema.table("event", {
  eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
  eventTypeId: bigint("event_type_id", { mode: "number" })
    .notNull()
    .references(() => eventType.eventTypeId),
  seriesId: bigint("series_id", { mode: "number" }).references(
    () => eventSeries.seriesId
  ),
  branchId: bigint("branch_id", { mode: "number" }).references(
    () => branch.branchId
  ),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  venue: text("venue"),
  expectedAttendance: integer("expected_attendance"),
  status: eventStatusEnum("status").notNull().default("SCHEDULED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventRegistration = eventsSchema.table("event_registration", {
  registrationId: bigserial("registration_id", { mode: "number" }).primaryKey(),
  eventId: bigint("event_id", { mode: "number" })
    .notNull()
    .references(() => event.eventId),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: registrationStatusEnum("status").notNull().default("REGISTERED"),
  groupSize: integer("group_size").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
