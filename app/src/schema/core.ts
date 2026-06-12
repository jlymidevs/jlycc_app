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
  ghlContactId: text("ghl_contact_id"),
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

export const addressTypeEnum = coreSchema.enum("address_type", [
  "HOME",
  "WORK",
  "MAILING",
]);

export const address = coreSchema.table("address", {
  addressId: bigserial("address_id", { mode: "number" }).primaryKey(),
  line1: text("line1"),
  line2: text("line2"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  countryCode: text("country_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const personAddress = coreSchema.table("person_address", {
  personId: bigint("person_id", { mode: "number" })
    .notNull()
    .references(() => person.personId, { onDelete: "cascade" }),
  addressId: bigint("address_id", { mode: "number" })
    .notNull()
    .references(() => address.addressId),
  type: addressTypeEnum("type").notNull(),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
