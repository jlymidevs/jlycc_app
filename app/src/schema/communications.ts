import {
  bigserial,
  bigint,
  text,
  timestamp,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person } from "./core";

export const communicationsSchema = pgSchema("communications");

export const announcementTargetTypeEnum = communicationsSchema.enum(
  "announcement_target_type",
  ["ALL_MEMBERS", "BRANCH", "LIFECYCLE_STAGE", "MANUAL"]
);

export const announcementStatusEnum = communicationsSchema.enum(
  "announcement_status",
  ["DRAFT", "PUBLISHED", "ARCHIVED"]
);

export const announcement = communicationsSchema.table("announcement", {
  announcementId: bigserial("announcement_id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  targetType: announcementTargetTypeEnum("target_type").notNull(),
  targetId: text("target_id"),
  status: announcementStatusEnum("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdByPersonId: bigint("created_by_person_id", { mode: "number" }).references(
    () => person.personId
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const announcementRecipient = communicationsSchema.table(
  "announcement_recipient",
  {
    recipientId: bigserial("recipient_id", { mode: "number" }).primaryKey(),
    announcementId: bigint("announcement_id", { mode: "number" })
      .notNull()
      .references(() => announcement.announcementId, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => person.personId),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);
