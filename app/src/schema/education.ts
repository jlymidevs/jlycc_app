// app/src/schema/education.ts
import {
  bigserial,
  bigint,
  boolean,
  text,
  timestamp,
  integer,
  date,
  numeric,
  jsonb,
  pgSchema,
} from "drizzle-orm/pg-core";
import { person, branch } from "./core";
import { member } from "./membership";

export const educationSchema = pgSchema("education");

// Enums
export const schoolStatusEnum = educationSchema.enum("school_status", ["ACTIVE", "INACTIVE"]);
export const semesterStatusEnum = educationSchema.enum("semester_status", ["PLANNED", "REGISTRATION", "ACTIVE", "GRADING", "CLOSED"]);
export const bcStudentStatusEnum = educationSchema.enum("bc_student_status", ["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"]);
export const bcEnrollmentStatusEnum = educationSchema.enum("bc_enrollment_status", ["ENROLLED", "DROPPED", "COMPLETED", "WITHDRAWN"]);
export const bcCompletionStatusEnum = educationSchema.enum("bc_completion_status", ["COMPLETED", "INCOMPLETE", "WITHDRAWN"]);
export const isuStudentStatusEnum = educationSchema.enum("isu_student_status", ["ACTIVE", "INACTIVE", "COMPLETED"]);

// BC tables
export const bcProgram = educationSchema.table("bc_program", {
  programId: bigserial("program_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  degreeLevel: text("degree_level"),
  totalCredits: integer("total_credits"),
  durationYears: integer("duration_years"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcCohort = educationSchema.table("bc_cohort", {
  cohortId: bigserial("cohort_id", { mode: "number" }).primaryKey(),
  programId: bigint("program_id", { mode: "number" }).notNull().references(() => bcProgram.programId),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  expectedGraduationOn: date("expected_graduation_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcSemester = educationSchema.table("bc_semester", {
  semesterId: bigserial("semester_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  academicYear: text("academic_year"),
  termNumber: integer("term_number"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  status: semesterStatusEnum("status").notNull().default("PLANNED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcCourse = educationSchema.table("bc_course", {
  courseId: bigserial("course_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  credits: integer("credits"),
  description: text("description"),
  department: text("department"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcCourseOffering = educationSchema.table("bc_course_offering", {
  offeringId: bigserial("offering_id", { mode: "number" }).primaryKey(),
  courseId: bigint("course_id", { mode: "number" }).notNull().references(() => bcCourse.courseId),
  semesterId: bigint("semester_id", { mode: "number" }).notNull().references(() => bcSemester.semesterId),
  instructorMemberId: bigint("instructor_member_id", { mode: "number" }).references(() => member.memberId),
  maxSeats: integer("max_seats"),
  schedule: jsonb("schedule").notNull().default({}),
  venue: text("venue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcStudent = educationSchema.table("bc_student", {
  studentId: bigserial("student_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().unique().references(() => person.personId),
  cohortId: bigint("cohort_id", { mode: "number" }).notNull().references(() => bcCohort.cohortId),
  studentNumber: text("student_number").notNull().unique(),
  enrolledOn: date("enrolled_on").notNull(),
  status: bcStudentStatusEnum("status").notNull().default("ACTIVE"),
  graduatedOn: date("graduated_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcEnrollment = educationSchema.table("bc_enrollment", {
  enrollmentId: bigserial("enrollment_id", { mode: "number" }).primaryKey(),
  studentId: bigint("student_id", { mode: "number" }).notNull().references(() => bcStudent.studentId, { onDelete: "cascade" }),
  offeringId: bigint("offering_id", { mode: "number" }).notNull().references(() => bcCourseOffering.offeringId, { onDelete: "cascade" }),
  enrolledOn: date("enrolled_on").notNull(),
  status: bcEnrollmentStatusEnum("status").notNull().default("ENROLLED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bcCompletion = educationSchema.table("bc_completion", {
  enrollmentId: bigint("enrollment_id", { mode: "number" }).primaryKey().references(() => bcEnrollment.enrollmentId),
  status: bcCompletionStatusEnum("status").notNull(),
  completedOn: date("completed_on"),
  attendanceRate: numeric("attendance_rate"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bcClassAttendance = educationSchema.table("bc_class_attendance", {
  attendanceId: bigserial("attendance_id", { mode: "number" }).primaryKey(),
  offeringId: bigint("offering_id", { mode: "number" }).notNull().references(() => bcCourseOffering.offeringId, { onDelete: "cascade" }),
  studentId: bigint("student_id", { mode: "number" }).notNull().references(() => bcStudent.studentId, { onDelete: "cascade" }),
  classDate: date("class_date").notNull(),
  attended: boolean("attended").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ISU tables
export const isuTrack = educationSchema.table("isu_track", {
  trackId: bigserial("track_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const isuStudent = educationSchema.table("isu_student", {
  studentId: bigserial("student_id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().unique().references(() => person.personId),
  currentTrackId: bigint("current_track_id", { mode: "number" }).references(() => isuTrack.trackId),
  enrolledOn: date("enrolled_on").notNull(),
  status: isuStudentStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const isuTrackProgression = educationSchema.table("isu_track_progression", {
  progressionId: bigserial("progression_id", { mode: "number" }).primaryKey(),
  studentId: bigint("student_id", { mode: "number" }).notNull().references(() => isuStudent.studentId, { onDelete: "cascade" }),
  fromTrackId: bigint("from_track_id", { mode: "number" }).references(() => isuTrack.trackId),
  toTrackId: bigint("to_track_id", { mode: "number" }).notNull().references(() => isuTrack.trackId),
  progressedAt: timestamp("progressed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const isuSession = educationSchema.table("isu_session", {
  sessionId: bigserial("session_id", { mode: "number" }).primaryKey(),
  branchId: bigint("branch_id", { mode: "number" }).notNull().references(() => branch.branchId),
  trackId: bigint("track_id", { mode: "number" }).notNull().references(() => isuTrack.trackId),
  topic: text("topic"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  facilitatorMemberId: bigint("facilitator_member_id", { mode: "number" }).references(() => member.memberId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const isuSessionAttendance = educationSchema.table("isu_session_attendance", {
  attendanceId: bigserial("attendance_id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(() => isuSession.sessionId, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => person.personId),
  attended: boolean("attended").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});