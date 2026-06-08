// app/src/schema/events.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  jsonb,
  pgSchema,
  primaryKey,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";

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

export const eventCategory = eventsSchema.table("event_category", {
  categoryCode: text("category_code").primaryKey(),
  name: text("name").notNull(),
});

export const eventType = eventsSchema.table("event_type", {
  eventTypeId: bigserial("event_type_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryCode: text("category_code").notNull().references(() => eventCategory.categoryCode),
  networkId: bigint("network_id", { mode: "number" }),
  ministryId: bigint("ministry_id", { mode: "number" }),
  typicalDurationMinutes: integer("typical_duration_minutes"),
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
  hostBranchId: bigint("host_branch_id", { mode: "number" }).references(() => branch.branchId),
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
  registeredByMemberId: bigint("registered_by_member_id", { mode: "number" }).references(() => member.memberId),
  status: registrationStatusEnum("status").notNull().default("REGISTERED"),
  accommodationRequired: boolean("accommodation_required").notNull().default(false),
  dietaryRequirements: text("dietary_requirements"),
  groupSize: integer("group_size").notNull().default(1),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventOrganizer = eventsSchema.table(
  "event_organizer",
  {
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => event.eventId, { onDelete: "cascade" }),
    memberId: bigint("member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId),
    role: text("role").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.memberId] })]
);
