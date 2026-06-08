# Plan 8: Education (Bible College + ISU) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two admin education modules — Bible College (BC) student/enrollment/attendance tracking and ISU (International Success University) student/track-progression/session tracking.

**Architecture:** All 14 education tables already exist in DB (V050–V058). One new Drizzle schema file (`education.ts`), two validation files, two action files, 12 route pages across two sub-namespaces (`/education/bc/*` and `/education/isu/*`), and a shared "Education" nav dropdown link. No migrations needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM (`education` schema), Zod, Vitest, Playwright.

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/src/schema/education.ts` |
| Create | `app/src/lib/validations/education-bc.ts` |
| Create | `app/src/lib/validations/education-isu.ts` |
| Create | `app/src/actions/education-bc.ts` |
| Create | `app/src/actions/education-isu.ts` |
| Create | `app/src/app/(admin)/education/bc/students/page.tsx` |
| Create | `app/src/app/(admin)/education/bc/students/new/page.tsx` |
| Create | `app/src/app/(admin)/education/bc/students/[id]/page.tsx` |
| Create | `app/src/app/(admin)/education/bc/offerings/page.tsx` |
| Create | `app/src/app/(admin)/education/bc/offerings/[id]/page.tsx` |
| Create | `app/src/app/(admin)/education/bc/offerings/[id]/attendance/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/students/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/students/new/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/students/[id]/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/sessions/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/sessions/new/page.tsx` |
| Create | `app/src/app/(admin)/education/isu/sessions/[id]/attendance/page.tsx` |
| Create | `app/tests/unit/education-bc.test.ts` |
| Create | `app/tests/unit/education-isu.test.ts` |
| Create | `app/tests/e2e/education.spec.ts` |
| Modify | `app/src/app/(admin)/layout.tsx` |

**Total: 21 changes (20 new files + 1 nav update). No migrations.**

---

## DB Schema Reference

Read these migration files before implementing — they define exact column names:
- `db/migrations/V050__create_education_schema.sql` — enums + `school` table
- `db/migrations/V051__education_bc_program_cohort.sql` — `bc_program`, `bc_cohort`
- `db/migrations/V052__education_bc_semester_course.sql` — `bc_semester`, `bc_course`
- `db/migrations/V053__education_bc_course_offering.sql` — `bc_course_offering`
- `db/migrations/V054__education_bc_student.sql` — `bc_student`
- `db/migrations/V055__education_bc_enrollment_completion.sql` — `bc_enrollment`, `bc_completion`
- `db/migrations/V056__education_bc_class_attendance.sql` — `bc_class_attendance`
- `db/migrations/V057__education_isu_track_student.sql` — `isu_track`, `isu_student`
- `db/migrations/V058__education_isu_progression_session.sql` — `isu_track_progression`, `isu_session`, `isu_session_attendance`

Key constraints:
- `bc_student.person_id` UNIQUE — one student record per person
- `bc_enrollment` UNIQUE(student_id, offering_id)
- `bc_course_offering` UNIQUE(course_id, semester_id)
- `bc_class_attendance` UNIQUE(offering_id, student_id, class_date)
- `isu_student.person_id` UNIQUE
- `isu_session_attendance` UNIQUE(session_id, person_id)
- `isu_track_progression.from_track_id` is NULL for initial enrollment

---

## Task 1: Education Drizzle Schema

**Files:**
- Create: `app/src/schema/education.ts`

**Pattern:** Follow `app/src/schema/events.ts` exactly. Use `pgSchema("education")`, define enums with `schema.enum(...)`, bigserial/bigint with `{ mode: "number" }`, `$onUpdateFn(() => new Date())` on `updated_at`.

- [ ] **Step 1: Create schema file**

```ts
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/schema/education.ts
git commit -m "feat(schema): add Drizzle schema for education (BC + ISU)"
```

---

## Task 2: BC Validation Schemas

**Files:**
- Create: `app/src/lib/validations/education-bc.ts`

**Pattern:** Follow `app/src/lib/validations/member.ts`. Import from `zod`, export schema + inferred type.

- [ ] **Step 1: Write failing unit tests first**

Create `app/tests/unit/education-bc.test.ts`:

```ts
// app/tests/unit/education-bc.test.ts
import { describe, it, expect } from "vitest";
import {
  registerBcStudentSchema,
  enrollInOfferingSchema,
  recordClassAttendanceSchema,
} from "@/lib/validations/education-bc";

describe("registerBcStudentSchema", () => {
  it("accepts valid input", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing personId", () => {
    const result = registerBcStudentSchema.safeParse({
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects missing studentNumber", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("studentNumber");
  });

  it("rejects invalid enrolledOn date", () => {
    const result = registerBcStudentSchema.safeParse({
      personId: 1,
      cohortId: 1,
      studentNumber: "BC-2026-001",
      enrolledOn: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("enrollInOfferingSchema", () => {
  it("accepts valid input", () => {
    const result = enrollInOfferingSchema.safeParse({
      studentId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing studentId", () => {
    const result = enrollInOfferingSchema.safeParse({ enrolledOn: "2026-01-15" });
    expect(result.success).toBe(false);
  });
});

describe("recordClassAttendanceSchema", () => {
  it("accepts present", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts absent", () => {
    const result = recordClassAttendanceSchema.safeParse({
      studentId: 1,
      classDate: "2026-03-10",
      attended: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing classDate", () => {
    const result = recordClassAttendanceSchema.safeParse({ studentId: 1, attended: true });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npx vitest run tests/unit/education-bc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create validation file**

```ts
// app/src/lib/validations/education-bc.ts
import { z } from "zod";

export const registerBcStudentSchema = z.object({
  personId: z.number().int().positive("Person is required"),
  cohortId: z.number().int().positive("Cohort is required"),
  studentNumber: z.string().min(1, "Student number is required"),
  enrolledOn: z.string().date("Invalid date"),
  status: z.enum(["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"]).optional(),
});

export const enrollInOfferingSchema = z.object({
  studentId: z.number().int().positive("Student is required"),
  enrolledOn: z.string().date("Invalid date"),
});

export const recordClassAttendanceSchema = z.object({
  studentId: z.number().int().positive("Student is required"),
  classDate: z.string().date("Invalid date"),
  attended: z.boolean(),
  notes: z.string().optional(),
});

export type RegisterBcStudentInput = z.infer<typeof registerBcStudentSchema>;
export type EnrollInOfferingInput = z.infer<typeof enrollInOfferingSchema>;
export type RecordClassAttendanceInput = z.infer<typeof recordClassAttendanceSchema>;
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd app && npx vitest run tests/unit/education-bc.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/education-bc.ts app/tests/unit/education-bc.test.ts
git commit -m "feat(validation): add BC education validation schemas with unit tests"
```

---

## Task 3: ISU Validation Schemas

**Files:**
- Create: `app/src/lib/validations/education-isu.ts`
- Create: `app/tests/unit/education-isu.test.ts`

- [ ] **Step 1: Write failing unit tests first**

Create `app/tests/unit/education-isu.test.ts`:

```ts
// app/tests/unit/education-isu.test.ts
import { describe, it, expect } from "vitest";
import {
  registerIsuStudentSchema,
  progressTrackSchema,
  createIsuSessionSchema,
} from "@/lib/validations/education-isu";

describe("registerIsuStudentSchema", () => {
  it("accepts valid input", () => {
    const result = registerIsuStudentSchema.safeParse({
      personId: 1,
      currentTrackId: 2,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without currentTrackId (optional)", () => {
    const result = registerIsuStudentSchema.safeParse({
      personId: 1,
      enrolledOn: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing personId", () => {
    const result = registerIsuStudentSchema.safeParse({ enrolledOn: "2026-01-15" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("personId");
  });

  it("rejects invalid enrolledOn", () => {
    const result = registerIsuStudentSchema.safeParse({ personId: 1, enrolledOn: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("progressTrackSchema", () => {
  it("accepts valid toTrackId", () => {
    const result = progressTrackSchema.safeParse({ toTrackId: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects missing toTrackId", () => {
    const result = progressTrackSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createIsuSessionSchema", () => {
  it("accepts minimal input", () => {
    const result = createIsuSessionSchema.safeParse({ branchId: 1, trackId: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects missing branchId", () => {
    const result = createIsuSessionSchema.safeParse({ trackId: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("branchId");
  });

  it("rejects missing trackId", () => {
    const result = createIsuSessionSchema.safeParse({ branchId: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("trackId");
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

```bash
cd app && npx vitest run tests/unit/education-isu.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create validation file**

```ts
// app/src/lib/validations/education-isu.ts
import { z } from "zod";

export const registerIsuStudentSchema = z.object({
  personId: z.number().int().positive("Person is required"),
  currentTrackId: z.number().int().positive().optional(),
  enrolledOn: z.string().date("Invalid date"),
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]).optional(),
});

export const progressTrackSchema = z.object({
  toTrackId: z.number().int().positive("Track is required"),
  notes: z.string().optional(),
});

export const createIsuSessionSchema = z.object({
  branchId: z.number().int().positive("Branch is required"),
  trackId: z.number().int().positive("Track is required"),
  topic: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export type RegisterIsuStudentInput = z.infer<typeof registerIsuStudentSchema>;
export type ProgressTrackInput = z.infer<typeof progressTrackSchema>;
export type CreateIsuSessionInput = z.infer<typeof createIsuSessionSchema>;
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd app && npx vitest run tests/unit/education-isu.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/validations/education-isu.ts app/tests/unit/education-isu.test.ts
git commit -m "feat(validation): add ISU education validation schemas with unit tests"
```

---

## Task 4: BC Server Actions

**Files:**
- Create: `app/src/actions/education-bc.ts`

**Pattern:** Follow `app/src/actions/programs.ts`. "use server", Zod parse, `as any` for bigint FKs, `revalidatePath`, `redirect`. Return `{ errors }` for validation failures, `{ error }` for DB errors.

- [ ] **Step 1: Create action file**

```ts
// app/src/actions/education-bc.ts
"use server";

import { db } from "@/lib/db";
import {
  bcStudent, bcEnrollment, bcCompletion, bcClassAttendance,
} from "@/schema/education";
import {
  registerBcStudentSchema, enrollInOfferingSchema, recordClassAttendanceSchema,
} from "@/lib/validations/education-bc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

export async function registerBcStudent(formData: FormData) {
  const raw = {
    personId: Number(formData.get("personId")),
    cohortId: Number(formData.get("cohortId")),
    studentNumber: formData.get("studentNumber") as string,
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = registerBcStudentSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    const [s] = await db.insert(bcStudent).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: parsed.data.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cohortId: parsed.data.cohortId as any,
      studentNumber: parsed.data.studentNumber,
      enrolledOn: parsed.data.enrolledOn,
    }).returning({ studentId: bcStudent.studentId });

    revalidatePath("/education/bc/students");
    redirect(`/education/bc/students/${s.studentId}`);
  } catch {
    return { error: "Student already registered for this person" };
  }
}

export async function enrollInOffering(offeringId: number, formData: FormData) {
  const raw = {
    studentId: Number(formData.get("studentId")),
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = enrollInOfferingSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db.insert(bcEnrollment).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentId: parsed.data.studentId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      offeringId: offeringId as any,
      enrolledOn: parsed.data.enrolledOn,
    });
  } catch {
    return { error: "Student already enrolled in this offering" };
  }

  revalidatePath(`/education/bc/offerings/${offeringId}`);
  redirect(`/education/bc/offerings/${offeringId}`);
}

export async function recordClassAttendance(offeringId: number, formData: FormData) {
  const raw = {
    studentId: Number(formData.get("studentId")),
    classDate: formData.get("classDate") as string,
    attended: formData.get("attended") === "true",
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = recordClassAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db.insert(bcClassAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offeringId: offeringId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studentId: parsed.data.studentId as any,
    classDate: parsed.data.classDate,
    attended: parsed.data.attended,
    notes: parsed.data.notes,
  }).onConflictDoUpdate({
    target: [bcClassAttendance.offeringId, bcClassAttendance.studentId, bcClassAttendance.classDate],
    set: { attended: parsed.data.attended, notes: parsed.data.notes },
  });

  revalidatePath(`/education/bc/offerings/${offeringId}/attendance`);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/education-bc.ts
git commit -m "feat(actions): add BC education server actions"
```

---

## Task 5: ISU Server Actions

**Files:**
- Create: `app/src/actions/education-isu.ts`

- [ ] **Step 1: Create action file**

```ts
// app/src/actions/education-isu.ts
"use server";

import { db } from "@/lib/db";
import {
  isuStudent, isuTrackProgression, isuSession, isuSessionAttendance,
} from "@/schema/education";
import {
  registerIsuStudentSchema, progressTrackSchema, createIsuSessionSchema,
} from "@/lib/validations/education-isu";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function registerIsuStudent(formData: FormData) {
  const raw = {
    personId: Number(formData.get("personId")),
    currentTrackId: formData.get("currentTrackId") ? Number(formData.get("currentTrackId")) : undefined,
    enrolledOn: formData.get("enrolledOn") as string,
  };
  const parsed = registerIsuStudentSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    const [s] = await db.insert(isuStudent).values({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personId: parsed.data.personId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentTrackId: parsed.data.currentTrackId as any,
      enrolledOn: parsed.data.enrolledOn,
    }).returning({ studentId: isuStudent.studentId });

    // Record initial track progression if track given
    if (parsed.data.currentTrackId) {
      await db.insert(isuTrackProgression).values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        studentId: s.studentId as any,
        fromTrackId: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toTrackId: parsed.data.currentTrackId as any,
      });
    }

    revalidatePath("/education/isu/students");
    redirect(`/education/isu/students/${s.studentId}`);
  } catch {
    return { error: "Student already registered for this person" };
  }
}

export async function progressTrack(studentId: number, formData: FormData) {
  const raw = {
    toTrackId: Number(formData.get("toTrackId")),
    notes: (formData.get("notes") as string) || undefined,
  };
  const parsed = progressTrackSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // get current track for from_track_id
  const [student] = await db
    .select({ currentTrackId: isuStudent.currentTrackId })
    .from(isuStudent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));
  if (!student) return { error: "Student not found" };

  await db.insert(isuTrackProgression).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studentId: studentId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fromTrackId: student.currentTrackId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toTrackId: parsed.data.toTrackId as any,
    notes: parsed.data.notes,
  });

  await db.update(isuStudent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ currentTrackId: parsed.data.toTrackId as any })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));

  revalidatePath(`/education/isu/students/${studentId}`);
  redirect(`/education/isu/students/${studentId}`);
}

export async function createIsuSession(formData: FormData) {
  const raw = {
    branchId: Number(formData.get("branchId")),
    trackId: Number(formData.get("trackId")),
    topic: (formData.get("topic") as string) || undefined,
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
  };
  const parsed = createIsuSessionSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [s] = await db.insert(isuSession).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId: parsed.data.branchId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackId: parsed.data.trackId as any,
    topic: parsed.data.topic,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
  }).returning({ sessionId: isuSession.sessionId });

  revalidatePath("/education/isu/sessions");
  redirect(`/education/isu/sessions/${s.sessionId}/attendance`);
}

export async function markIsuAttendance(sessionId: number, personId: number, attended: boolean) {
  await db.insert(isuSessionAttendance).values({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionId: sessionId as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personId: personId as any,
    attended,
  }).onConflictDoUpdate({
    target: [isuSessionAttendance.sessionId, isuSessionAttendance.personId],
    set: { attended },
  });
  revalidatePath(`/education/isu/sessions/${sessionId}/attendance`);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/actions/education-isu.ts
git commit -m "feat(actions): add ISU education server actions"
```

---

## Task 6: Nav Update + BC Pages

**Files:**
- Modify: `app/src/app/(admin)/layout.tsx`
- Create: `app/src/app/(admin)/education/bc/students/page.tsx`
- Create: `app/src/app/(admin)/education/bc/students/new/page.tsx`
- Create: `app/src/app/(admin)/education/bc/students/[id]/page.tsx`
- Create: `app/src/app/(admin)/education/bc/offerings/page.tsx`
- Create: `app/src/app/(admin)/education/bc/offerings/[id]/page.tsx`
- Create: `app/src/app/(admin)/education/bc/offerings/[id]/attendance/page.tsx`

**Pattern:** Follow `app/src/app/(admin)/programs/heartlink/` pages exactly (same styling, same Drizzle query patterns, same `force-dynamic`, same `notFound()` usage, same form action pattern).

- [ ] **Step 1: Add Education link to admin nav**

In `app/src/app/(admin)/layout.tsx`, add after the "Programs" `<Link>`:

```tsx
<Link
  href="/education/bc/students"
  className="text-sm text-gray-600 hover:text-gray-900"
>
  Education
</Link>
```

- [ ] **Step 2: Create BC student list page**

```tsx
// app/src/app/(admin)/education/bc/students/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcStudent, bcCohort, bcProgram } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcStudentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type StudentStatus = "ACTIVE" | "ON_LEAVE" | "GRADUATED" | "WITHDRAWN" | "DISMISSED";
  const statusValues: StudentStatus[] =
    statusFilter === "all"
      ? ["ACTIVE", "ON_LEAVE", "GRADUATED", "WITHDRAWN", "DISMISSED"]
      : statusFilter === "graduated"
      ? ["GRADUATED"]
      : ["ACTIVE", "ON_LEAVE"];

  const students = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcStudent.status,
      enrolledOn: bcStudent.enrolledOn,
      firstName: person.firstName,
      lastName: person.lastName,
      cohortName: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcStudent)
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .innerJoin(bcCohort, eq(bcStudent.cohortId, bcCohort.cohortId))
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    .where(inArray(bcStudent.status, statusValues))
    .orderBy(desc(bcStudent.studentId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">BC Students</h1>
        <Link
          href="/education/bc/students/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register student
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "graduated", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/education/bc/students?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students found.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Number</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Program / Cohort</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/education/bc/students/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.studentNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{s.programName} — {s.cohortName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <Link href="/education/bc/offerings" className="text-sm text-blue-600 hover:underline">
          View course offerings →
        </Link>
        <Link href="/education/isu/students" className="text-sm text-blue-600 hover:underline">
          Switch to ISU →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create BC register student page**

```tsx
// app/src/app/(admin)/education/bc/students/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcCohort, bcProgram } from "@/schema/education";
import { eq } from "drizzle-orm";
import { registerBcStudent } from "@/actions/education-bc";

export default async function RegisterBcStudentPage() {
  const cohorts = await db
    .select({
      cohortId: bcCohort.cohortId,
      name: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcCohort)
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    .orderBy(bcCohort.name);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Register student</h1>
      </div>
      <form action={(fd) => void registerBcStudent(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person ID <span className="text-red-500">*</span>
          </label>
          <input name="personId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cohort <span className="text-red-500">*</span>
          </label>
          <select name="cohortId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select cohort…</option>
            {cohorts.map((c) => (
              <option key={c.cohortId} value={c.cohortId}>{c.programName} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Student number <span className="text-red-500">*</span>
          </label>
          <input name="studentNumber" type="text" required placeholder="BC-2026-001"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enrolled on <span className="text-red-500">*</span>
          </label>
          <input name="enrolledOn" type="date" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Register student
          </button>
          <Link href="/education/bc/students"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create BC student detail page**

```tsx
// app/src/app/(admin)/education/bc/students/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bcStudent, bcCohort, bcProgram, bcEnrollment, bcCourseOffering, bcCourse, bcSemester } from "@/schema/education";
import { person } from "@/schema/core";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcStudentDetailPage({ params }: { params: { id: string } }) {
  const studentId = Number(params.id);

  const [student] = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcStudent.status,
      enrolledOn: bcStudent.enrolledOn,
      graduatedOn: bcStudent.graduatedOn,
      firstName: person.firstName,
      lastName: person.lastName,
      cohortName: bcCohort.name,
      programName: bcProgram.name,
    })
    .from(bcStudent)
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .innerJoin(bcCohort, eq(bcStudent.cohortId, bcCohort.cohortId))
    .innerJoin(bcProgram, eq(bcCohort.programId, bcProgram.programId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcStudent.studentId, studentId as any));

  if (!student) notFound();

  const enrollments = await db
    .select({
      enrollmentId: bcEnrollment.enrollmentId,
      enrolledOn: bcEnrollment.enrolledOn,
      status: bcEnrollment.status,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
    })
    .from(bcEnrollment)
    .innerJoin(bcCourseOffering, eq(bcEnrollment.offeringId, bcCourseOffering.offeringId))
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.studentId, studentId as any))
    .orderBy(bcEnrollment.enrollmentId);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {student.studentNumber} · {student.programName} — {student.cohortName} · {student.status}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Course enrollments ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">No course enrollments yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Course</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Semester</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td className="px-4 py-3 text-gray-900">{e.courseCode} — {e.courseTitle}</td>
                    <td className="px-4 py-3 text-gray-600">{e.semesterName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create BC offerings list page**

```tsx
// app/src/app/(admin)/education/bc/offerings/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { bcCourseOffering, bcCourse, bcSemester } from "@/schema/education";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BcOfferingsPage() {
  const offerings = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      venue: bcCourseOffering.venue,
      maxSeats: bcCourseOffering.maxSeats,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
      semesterStatus: bcSemester.status,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    .orderBy(desc(bcCourseOffering.offeringId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">BC Course Offerings</h1>
        <Link href="/education/bc/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← BC Students
        </Link>
      </div>

      {offerings.length === 0 ? (
        <p className="text-sm text-gray-500">No course offerings found. Add via DB seed or admin.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Course</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Semester</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Venue</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offerings.map((o) => (
                <tr key={o.offeringId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{o.courseCode} — {o.courseTitle}</td>
                  <td className="px-4 py-3 text-gray-600">{o.semesterName} <span className="text-xs text-gray-400 uppercase">({o.semesterStatus})</span></td>
                  <td className="px-4 py-3 text-gray-600">{o.venue ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/education/bc/offerings/${o.offeringId}`} className="text-blue-600 hover:underline text-xs">
                      Detail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create BC offering detail page**

```tsx
// app/src/app/(admin)/education/bc/offerings/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  bcCourseOffering, bcCourse, bcSemester, bcEnrollment, bcStudent,
} from "@/schema/education";
import { person } from "@/schema/core";
import { eq, count } from "drizzle-orm";
import { enrollInOffering } from "@/actions/education-bc";

export const dynamic = "force-dynamic";

export default async function BcOfferingDetailPage({ params }: { params: { id: string } }) {
  const offeringId = Number(params.id);

  const [offering] = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      venue: bcCourseOffering.venue,
      maxSeats: bcCourseOffering.maxSeats,
      courseTitle: bcCourse.title,
      courseCode: bcCourse.code,
      semesterName: bcSemester.name,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcCourseOffering.offeringId, offeringId as any));

  if (!offering) notFound();

  const [{ enrolledCount }] = await db
    .select({ enrolledCount: count() })
    .from(bcEnrollment)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  const enrollments = await db
    .select({
      enrollmentId: bcEnrollment.enrollmentId,
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      status: bcEnrollment.status,
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(bcEnrollment)
    .innerJoin(bcStudent, eq(bcEnrollment.studentId, bcStudent.studentId))
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/education/bc/offerings" className="text-sm text-gray-500 hover:text-gray-900">
            ← Offerings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{offering.courseCode} — {offering.courseTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{offering.semesterName}{offering.venue ? ` · ${offering.venue}` : ""}</p>
        </div>
        <Link
          href={`/education/bc/offerings/${offeringId}/attendance`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Attendance
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{enrolledCount}</p>
          <p className="text-xs text-gray-500">Enrolled</p>
        </div>
        {offering.maxSeats && (
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{offering.maxSeats}</p>
            <p className="text-xs text-gray-500">Max seats</p>
          </div>
        )}
      </div>

      {/* Enroll student form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Enroll a student</h2>
        <form action={(fd) => void enrollInOffering(offeringId, fd)} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input name="studentId" type="number" required min="1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enrolled on</label>
            <input name="enrolledOn" type="date" required defaultValue={today}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Enroll
          </button>
        </form>
      </section>

      {/* Enrolled students */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Students ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">No students enrolled yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Number</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td className="px-4 py-3">
                      <Link href={`/education/bc/students/${e.studentId}`} className="text-blue-600 hover:underline">
                        {e.firstName} {e.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.studentNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Create BC class attendance page**

This page shows a date picker + checklist of enrolled students for that date.

```tsx
// app/src/app/(admin)/education/bc/offerings/[id]/attendance/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  bcCourseOffering, bcCourse, bcSemester, bcEnrollment, bcStudent, bcClassAttendance,
} from "@/schema/education";
import { person } from "@/schema/core";
import { eq, and } from "drizzle-orm";
import { recordClassAttendance } from "@/actions/education-bc";

export const dynamic = "force-dynamic";

export default async function BcClassAttendancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const offeringId = Number(params.id);
  const classDate = searchParams.date ?? new Date().toISOString().split("T")[0];

  const [offering] = await db
    .select({
      offeringId: bcCourseOffering.offeringId,
      courseCode: bcCourse.code,
      courseTitle: bcCourse.title,
      semesterName: bcSemester.name,
    })
    .from(bcCourseOffering)
    .innerJoin(bcCourse, eq(bcCourseOffering.courseId, bcCourse.courseId))
    .innerJoin(bcSemester, eq(bcCourseOffering.semesterId, bcSemester.semesterId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcCourseOffering.offeringId, offeringId as any));

  if (!offering) notFound();

  const students = await db
    .select({
      studentId: bcStudent.studentId,
      studentNumber: bcStudent.studentNumber,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: bcClassAttendance.attended,
    })
    .from(bcEnrollment)
    .innerJoin(bcStudent, eq(bcEnrollment.studentId, bcStudent.studentId))
    .innerJoin(person, eq(bcStudent.personId, person.personId))
    .leftJoin(
      bcClassAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(bcClassAttendance.offeringId, offeringId as any),
        eq(bcClassAttendance.studentId, bcStudent.studentId),
        eq(bcClassAttendance.classDate, classDate),
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(bcEnrollment.offeringId, offeringId as any));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/education/bc/offerings/${offeringId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {offering.courseCode} {offering.courseTitle}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Class Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">{offering.semesterName}</p>
      </div>

      {/* Date picker */}
      <form method="GET" className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class date</label>
          <input
            name="date"
            type="date"
            defaultValue={classDate}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Load
        </button>
      </form>

      {/* Attendance checklist */}
      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students enrolled.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-center font-medium text-gray-700">Present</th>
                <th className="px-4 py-2 text-center font-medium text-gray-700">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td className="px-4 py-3 text-gray-900">{s.firstName} {s.lastName} <span className="text-xs text-gray-400">#{s.studentNumber}</span></td>
                  <td className="px-4 py-3 text-center">
                    <form action={(fd) => {
                      fd.set("studentId", String(s.studentId));
                      fd.set("classDate", classDate);
                      fd.set("attended", "true");
                      void recordClassAttendance(offeringId, fd);
                    }}>
                      <input type="hidden" name="studentId" value={s.studentId} />
                      <input type="hidden" name="classDate" value={classDate} />
                      <input type="hidden" name="attended" value="true" />
                      <button type="submit"
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          s.attended === true ? "bg-green-100 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-green-50"
                        }`}>
                        ✓
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <form action={(fd) => {
                      fd.set("studentId", String(s.studentId));
                      fd.set("classDate", classDate);
                      fd.set("attended", "false");
                      void recordClassAttendance(offeringId, fd);
                    }}>
                      <input type="hidden" name="studentId" value={s.studentId} />
                      <input type="hidden" name="classDate" value={classDate} />
                      <input type="hidden" name="attended" value="false" />
                      <button type="submit"
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          s.attended === false ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-500 hover:bg-red-50"
                        }`}>
                        ✗
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Note on form pattern for attendance:** The `recordClassAttendance` action reads `studentId`, `classDate`, and `attended` from formData. Use hidden inputs instead of fd.set in the action callback — simpler and correct:

```tsx
{/* Present button form — correct pattern */}
<form action={(fd) => void recordClassAttendance(offeringId, fd)}>
  <input type="hidden" name="studentId" value={s.studentId} />
  <input type="hidden" name="classDate" value={classDate} />
  <input type="hidden" name="attended" value="true" />
  <button type="submit" className={...}>✓</button>
</form>
```

Use this pattern (hidden inputs) — not `fd.set` in the callback. Rewrite the attendance cells using this pattern.

- [ ] **Step 8: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/src/app/(admin)/layout.tsx "app/src/app/(admin)/education/bc"
git commit -m "feat(bc): add Bible College student, offering, and attendance pages"
```

---

## Task 7: ISU Pages

**Files:**
- Create: `app/src/app/(admin)/education/isu/students/page.tsx`
- Create: `app/src/app/(admin)/education/isu/students/new/page.tsx`
- Create: `app/src/app/(admin)/education/isu/students/[id]/page.tsx`
- Create: `app/src/app/(admin)/education/isu/sessions/page.tsx`
- Create: `app/src/app/(admin)/education/isu/sessions/new/page.tsx`
- Create: `app/src/app/(admin)/education/isu/sessions/[id]/attendance/page.tsx`

**Pattern:** Follow BC pages and Heartlink pages for style. Note: ISU sessions use `person_id` for attendance (not student_id), so attendance checklist shows active ISU students for that track.

- [ ] **Step 1: Create ISU student list page**

```tsx
// app/src/app/(admin)/education/isu/students/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuStudent, isuTrack } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function IsuStudentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "active";
  type IsuStatus = "ACTIVE" | "INACTIVE" | "COMPLETED";
  const statusValues: IsuStatus[] =
    statusFilter === "all" ? ["ACTIVE", "INACTIVE", "COMPLETED"] :
    statusFilter === "completed" ? ["COMPLETED"] :
    ["ACTIVE"];

  const students = await db
    .select({
      studentId: isuStudent.studentId,
      enrolledOn: isuStudent.enrolledOn,
      status: isuStudent.status,
      firstName: person.firstName,
      lastName: person.lastName,
      trackName: isuTrack.name,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(isuTrack, eq(isuStudent.currentTrackId, isuTrack.trackId))
    .where(inArray(isuStudent.status, statusValues))
    .orderBy(desc(isuStudent.studentId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ISU Students</h1>
        <Link
          href="/education/isu/students/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register student
        </Link>
      </div>

      <div className="flex gap-2">
        {(["active", "completed", "all"] as const).map((s) => (
          <Link key={s} href={`/education/isu/students?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students found.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Current track</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/education/isu/students/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.trackName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <Link href="/education/isu/sessions" className="text-sm text-blue-600 hover:underline">
          View sessions →
        </Link>
        <Link href="/education/bc/students" className="text-sm text-blue-600 hover:underline">
          Switch to BC →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ISU register student page**

```tsx
// app/src/app/(admin)/education/isu/students/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuTrack } from "@/schema/education";
import { registerIsuStudent } from "@/actions/education-isu";

export default async function RegisterIsuStudentPage() {
  const tracks = await db
    .select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
    .from(isuTrack)
    .orderBy(isuTrack.orderIndex);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/isu/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Register ISU student</h1>
      </div>
      <form action={(fd) => void registerIsuStudent(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person ID <span className="text-red-500">*</span>
          </label>
          <input name="personId" type="number" required min="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Starting track</label>
          <select name="currentTrackId"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">None (assign later)</option>
            {tracks.map((t) => (
              <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enrolled on <span className="text-red-500">*</span>
          </label>
          <input name="enrolledOn" type="date" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Register student
          </button>
          <Link href="/education/isu/students"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create ISU student detail page**

```tsx
// app/src/app/(admin)/education/isu/students/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isuStudent, isuTrack, isuTrackProgression } from "@/schema/education";
import { person } from "@/schema/core";
import { eq, desc } from "drizzle-orm";
import { progressTrack } from "@/actions/education-isu";

export const dynamic = "force-dynamic";

export default async function IsuStudentDetailPage({ params }: { params: { id: string } }) {
  const studentId = Number(params.id);

  const [student] = await db
    .select({
      studentId: isuStudent.studentId,
      enrolledOn: isuStudent.enrolledOn,
      status: isuStudent.status,
      firstName: person.firstName,
      lastName: person.lastName,
      currentTrackName: isuTrack.name,
      currentTrackId: isuStudent.currentTrackId,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(isuTrack, eq(isuStudent.currentTrackId, isuTrack.trackId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuStudent.studentId, studentId as any));

  if (!student) notFound();

  const progressions = await db
    .select({
      progressionId: isuTrackProgression.progressionId,
      progressedAt: isuTrackProgression.progressedAt,
      notes: isuTrackProgression.notes,
      toTrackName: isuTrack.name,
    })
    .from(isuTrackProgression)
    .innerJoin(isuTrack, eq(isuTrackProgression.toTrackId, isuTrack.trackId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuTrackProgression.studentId, studentId as any))
    .orderBy(desc(isuTrackProgression.progressedAt));

  const allTracks = await db
    .select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
    .from(isuTrack)
    .orderBy(isuTrack.orderIndex);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/isu/students" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{student.firstName} {student.lastName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Current track: {student.currentTrackName ?? "None"} · {student.status}
        </p>
      </div>

      {/* Progress track form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Progress to track</h2>
        <form action={(fd) => void progressTrack(studentId, fd)} className="flex gap-3 items-end">
          <div className="flex-1">
            <select name="toTrackId" required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select track…</option>
              {allTracks.map((t) => (
                <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
              ))}
            </select>
          </div>
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Progress
          </button>
        </form>
      </section>

      {/* Track progression history */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Track history ({progressions.length})</h2>
        {progressions.length === 0 ? (
          <p className="text-sm text-gray-500">No track progressions yet.</p>
        ) : (
          <div className="space-y-2">
            {progressions.map((p) => (
              <div key={p.progressionId} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-gray-400 text-xs">{new Date(p.progressedAt).toLocaleDateString()}</span>
                <span>→ {p.toTrackName}</span>
                {p.notes && <span className="text-gray-400 text-xs">({p.notes})</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Create ISU session list page**

```tsx
// app/src/app/(admin)/education/isu/sessions/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuSession, isuTrack } from "@/schema/education";
import { branch } from "@/schema/core";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function IsuSessionsPage() {
  const sessions = await db
    .select({
      sessionId: isuSession.sessionId,
      topic: isuSession.topic,
      scheduledAt: isuSession.scheduledAt,
      trackName: isuTrack.name,
      trackCode: isuTrack.code,
      branchName: branch.name,
    })
    .from(isuSession)
    .innerJoin(isuTrack, eq(isuSession.trackId, isuTrack.trackId))
    .innerJoin(branch, eq(isuSession.branchId, branch.branchId))
    .orderBy(desc(isuSession.sessionId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ISU Sessions</h1>
        <Link
          href="/education/isu/sessions/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link key={s.sessionId} href={`/education/isu/sessions/${s.sessionId}/attendance`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {s.trackCode} — {s.trackName}{s.topic ? `: ${s.topic}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.branchName}{s.scheduledAt ? ` · ${new Date(s.scheduledAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="text-xs text-blue-600">Attendance →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create ISU new session page**

```tsx
// app/src/app/(admin)/education/isu/sessions/new/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { isuTrack } from "@/schema/education";
import { branch } from "@/schema/core";
import { createIsuSession } from "@/actions/education-isu";

export default async function NewIsuSessionPage() {
  const [tracks, branches] = await Promise.all([
    db.select({ trackId: isuTrack.trackId, name: isuTrack.name, code: isuTrack.code })
      .from(isuTrack).orderBy(isuTrack.orderIndex),
    db.select({ branchId: branch.branchId, name: branch.name })
      .from(branch).orderBy(branch.name),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/education/isu/sessions" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Sessions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New ISU session</h1>
      </div>
      <form action={(fd) => void createIsuSession(fd)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch <span className="text-red-500">*</span>
          </label>
          <select name="branchId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Track <span className="text-red-500">*</span>
          </label>
          <select name="trackId" required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select track…</option>
            {tracks.map((t) => (
              <option key={t.trackId} value={t.trackId}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
          <input name="topic" type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled at</label>
          <input name="scheduledAt" type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-3">
          <button type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create session
          </button>
          <Link href="/education/isu/sessions"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Create ISU session attendance page**

ISU attendance uses `person_id`, not `student_id`. Show active ISU students for the session's track as the checklist.

```tsx
// app/src/app/(admin)/education/isu/sessions/[id]/attendance/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isuSession, isuTrack, isuStudent, isuSessionAttendance } from "@/schema/education";
import { branch, person } from "@/schema/core";
import { eq, and } from "drizzle-orm";
import { markIsuAttendance } from "@/actions/education-isu";

export const dynamic = "force-dynamic";

export default async function IsuSessionAttendancePage({ params }: { params: { id: string } }) {
  const sessionId = Number(params.id);

  const [session] = await db
    .select({
      sessionId: isuSession.sessionId,
      topic: isuSession.topic,
      scheduledAt: isuSession.scheduledAt,
      trackName: isuTrack.name,
      trackCode: isuTrack.code,
      trackId: isuSession.trackId,
      branchName: branch.name,
    })
    .from(isuSession)
    .innerJoin(isuTrack, eq(isuSession.trackId, isuTrack.trackId))
    .innerJoin(branch, eq(isuSession.branchId, branch.branchId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(isuSession.sessionId, sessionId as any));

  if (!session) notFound();

  // active ISU students on this track
  const students = await db
    .select({
      personId: isuStudent.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      attended: isuSessionAttendance.attended,
    })
    .from(isuStudent)
    .innerJoin(person, eq(isuStudent.personId, person.personId))
    .leftJoin(
      isuSessionAttendance,
      and(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(isuSessionAttendance.sessionId, sessionId as any),
        eq(isuSessionAttendance.personId, isuStudent.personId),
      )
    )
    .where(and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(isuStudent.currentTrackId, session.trackId as any),
      eq(isuStudent.status, "ACTIVE"),
    ));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/education/isu/sessions" className="text-sm text-gray-500 hover:text-gray-900">
          ← ISU Sessions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {session.trackCode} Attendance
          {session.topic ? ` — ${session.topic}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {session.branchName}{session.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Students on this track ({students.length})</h2>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">No active students on this track.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Present</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.personId}>
                    <td className="px-4 py-3 text-gray-900">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-center">
                      <form action={(fd) => void markIsuAttendance(sessionId, s.personId, true)}>
                        <button type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            s.attended === true ? "bg-green-100 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-green-50"
                          }`}>✓</button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={(fd) => void markIsuAttendance(sessionId, s.personId, false)}>
                        <button type="submit"
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            s.attended === false ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-500 hover:bg-red-50"
                          }`}>✗</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "app/src/app/(admin)/education/isu"
git commit -m "feat(isu): add ISU student, session, and attendance pages"
```

---

## Task 8: E2E Tests

**Files:**
- Create: `app/tests/e2e/education.spec.ts`

**Pattern:** Follow `app/tests/e2e/programs.spec.ts` exactly.

- [ ] **Step 1: Create E2E test file**

```ts
// app/tests/e2e/education.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', STAFF_EMAIL);
  await page.fill('input[name="password"]', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/members");
}

test.describe("BC student management", () => {
  test("Education link visible in nav", async ({ page }) => {
    await staffLogin(page);
    await expect(page.getByRole("link", { name: "Education" })).toBeVisible();
  });

  test("BC students page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/students");
    await expect(page.getByRole("heading", { name: "BC Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register student" })).toBeVisible();
  });

  test("Register student page loads with cohort select", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/students/new");
    await expect(page.getByRole("heading", { name: "Register student" })).toBeVisible();
    await expect(page.locator('select[name="cohortId"]')).toBeVisible();
  });

  test("BC offerings page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/offerings");
    await expect(page.getByRole("heading", { name: "BC Course Offerings" })).toBeVisible();
  });
});

test.describe("ISU student management", () => {
  test("ISU students page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students");
    await expect(page.getByRole("heading", { name: "ISU Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register student" })).toBeVisible();
  });

  test("Register ISU student page loads with track select", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students/new");
    await expect(page.getByRole("heading", { name: "Register ISU student" })).toBeVisible();
    await expect(page.locator('select[name="currentTrackId"]')).toBeVisible();
  });

  test("staff can register an ISU student and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students/new");

    await page.fill('input[name="personId"]', "3");
    await page.fill('input[name="enrolledOn"]', "2026-01-15");
    await page.getByRole("button", { name: "Register student" }).click();

    await expect(page).toHaveURL(/\/education\/isu\/students\/\d+/);
    await expect(page.getByText("Current track:")).toBeVisible();
  });

  test("registered ISU student appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students");
    // list should have at least 1 student row
    await expect(page.locator("table tbody tr")).toHaveCount({ min: 1 } as any);
  });

  test("ISU sessions page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/sessions");
    await expect(page.getByRole("heading", { name: "ISU Sessions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New session" })).toBeVisible();
  });

  test("staff can create an ISU session", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/sessions/new");
    await expect(page.getByRole("heading", { name: "New ISU session" })).toBeVisible();

    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.selectOption('select[name="trackId"]', { index: 1 });
    await page.fill('input[name="topic"]', "E2E ISU Session Topic");
    await page.getByRole("button", { name: "Create session" }).click();

    await expect(page).toHaveURL(/\/education\/isu\/sessions\/\d+\/attendance/);
    await expect(page.getByText("Attendance")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit (do NOT run Playwright — requires live DB)**

```bash
git add app/tests/e2e/education.spec.ts
git commit -m "test(e2e): add Playwright E2E tests for BC and ISU education modules"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Drizzle schema for all 14 education tables | Task 1 |
| BC validation: register student, enroll in offering, record attendance | Task 2 |
| ISU validation: register student, progress track, create session | Task 3 |
| BC actions: registerBcStudent, enrollInOffering, recordClassAttendance | Task 4 |
| ISU actions: registerIsuStudent, progressTrack, createIsuSession, markIsuAttendance | Task 5 |
| BC pages: student list, register, detail, offerings list, offering detail, attendance | Task 6 |
| ISU pages: student list, register, detail, sessions list, new session, attendance | Task 7 |
| Nav updated with Education link | Task 6 Step 1 |
| E2E tests covering all main flows | Task 8 |
| Unit tests for all validation schemas | Tasks 2 + 3 |

### Placeholder scan

No TBD/TODO/placeholder text present. All code steps contain complete implementations.

### Type consistency

- `bcStudent.studentId` used consistently across all BC pages and actions
- `isuStudent.personId` used for ISU attendance (not `studentId`) — consistent with DB design
- Action function names match imports in pages: `registerBcStudent`, `enrollInOffering`, `recordClassAttendance`, `registerIsuStudent`, `progressTrack`, `createIsuSession`, `markIsuAttendance`
- Schema export names: `bcStudent`, `bcCohort`, `bcProgram`, `bcSemester`, `bcCourse`, `bcCourseOffering`, `bcEnrollment`, `bcCompletion`, `bcClassAttendance`, `isuTrack`, `isuStudent`, `isuTrackProgression`, `isuSession`, `isuSessionAttendance` — all consistent between Task 1 and all subsequent tasks

### Known limitation

BC class attendance form uses `fd.set()` in the action callback (mentioned in Task 6 Step 7). The note at the end of that step corrects this to use hidden `<input>` fields instead. The final implementation must use hidden inputs, not `fd.set()`.
