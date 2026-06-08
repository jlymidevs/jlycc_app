// app/src/schema/core.ts
import {
  bigserial,
  bigint,
  text,
  date,
  boolean,
  timestamp,
  char,
  pgSchema,
} from "drizzle-orm/pg-core";

export const coreSchema = pgSchema("core");

export const genderEnum = coreSchema.enum("gender", [
  "MALE",
  "FEMALE",
  "UNDISCLOSED",
]);
export const maritalStatusEnum = coreSchema.enum("marital_status", [
  "SINGLE",
  "MARRIED",
  "WIDOWED",
  "SEPARATED",
  "DIVORCED",
]);
export const contactTypeEnum = coreSchema.enum("contact_type", [
  "MOBILE",
  "EMAIL",
  "LANDLINE",
  "MESSENGER",
  "OTHER",
]);
export const branchTypeEnum = coreSchema.enum("branch_type", [
  "LOCAL",
  "INTERNATIONAL",
]);
export const branchStatusEnum = coreSchema.enum("branch_status", [
  "ACTIVE",
  "PLANTING",
  "CLOSED",
]);

export const person = coreSchema.table("person", {
  personId: bigserial("person_id", { mode: "number" }).primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  suffix: text("suffix"),
  preferredName: text("preferred_name"),
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),
  nationality: text("nationality"),
  profilePhotoUrl: text("profile_photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const branch = coreSchema.table("branch", {
  branchId: bigserial("branch_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  regionId: bigint("region_id", { mode: "number" }).notNull(),
  type: branchTypeEnum("type").notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  timezone: text("timezone").notNull(),
  primaryAddressId: bigint("primary_address_id", { mode: "number" }),
  launchedOn: date("launched_on"),
  status: branchStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const contactInfo = coreSchema.table("contact_info", {
  contactId: bigserial("contact_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId),
  type: contactTypeEnum("type").notNull(),
  value: text("value").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
