# ISU Course Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build future-proof ISU course categories, course management, and registered-member enrollments for Admin and Super Admin users.

**Architecture:** Add a small ISU course catalog beside the existing ISU track model. Keep database, Drizzle schema, validation, server actions, and pages in focused files so course catalog work does not disturb existing ISU student progression/session flows.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM, PostgreSQL/Flyway, Zod, Vitest, Tailwind CSS.

---

## File Structure

- Create: `db/migrations/V076__education_isu_course_catalog.sql`
  - Adds course category, course, enrollment status enum, and enrollment tables.
  - Seeds Basic, Advance, and Paid Courses.
- Modify: `app/src/schema/education.ts`
  - Adds Drizzle exports for new enum and tables.
- Create: `app/src/lib/validations/education-isu-courses.ts`
  - Pure Zod validation for course category, course, and enrollment inputs.
- Create: `app/tests/unit/education-isu-courses.test.ts`
  - Unit tests for validation behavior.
- Create: `app/src/actions/education-isu-courses.ts`
  - Server actions for add/edit/deactivate course and enroll/drop member.
  - Uses `requireRole("ADMIN")`.
- Create: `app/src/app/(admin)/education/isu/courses/page.tsx`
  - Main ISU course catalog page grouped by category.
- Create: `app/src/app/(admin)/education/isu/courses/[id]/page.tsx`
  - Course enrollment management page.
- Modify: `app/src/app/(admin)/education/isu/students/page.tsx`
  - Adds link from ISU students to ISU courses.

---

## Task 1: Validation

**Files:**
- Create: `app/src/lib/validations/education-isu-courses.ts`
- Create: `app/tests/unit/education-isu-courses.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Create `app/tests/unit/education-isu-courses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createIsuCourseCategorySchema,
  updateIsuCourseCategorySchema,
  createIsuCourseSchema,
  updateIsuCourseSchema,
  enrollIsuCourseMemberSchema,
  dropIsuCourseMemberSchema,
} from "@/lib/validations/education-isu-courses";

describe("createIsuCourseCategorySchema", () => {
  it("accepts a valid category", () => {
    const result = createIsuCourseCategorySchema.safeParse({
      name: "Paid Courses",
      slug: "paid-courses",
      description: "Courses with a payment step handled outside the app.",
      orderIndex: 3,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty category name", () => {
    const result = createIsuCourseCategorySchema.safeParse({
      name: "",
      slug: "basic",
      orderIndex: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });
});

describe("updateIsuCourseCategorySchema", () => {
  it("accepts a category update", () => {
    const result = updateIsuCourseCategorySchema.safeParse({
      categoryId: 1,
      name: "Basic",
      slug: "basic",
      orderIndex: 1,
      isActive: true,
    });

    expect(result.success).toBe(true);
  });
});

describe("createIsuCourseSchema", () => {
  it("accepts a valid course", () => {
    const result = createIsuCourseSchema.safeParse({
      categoryId: 1,
      title: "Leadership Foundations",
      description: "Core ISU leadership course.",
      orderIndex: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing category", () => {
    const result = createIsuCourseSchema.safeParse({
      categoryId: 0,
      title: "Leadership Foundations",
      orderIndex: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("categoryId");
  });
});

describe("updateIsuCourseSchema", () => {
  it("accepts a course update", () => {
    const result = updateIsuCourseSchema.safeParse({
      courseId: 1,
      categoryId: 2,
      title: "Advanced Leadership",
      description: "",
      orderIndex: 4,
      isActive: true,
    });

    expect(result.success).toBe(true);
  });
});

describe("enrollIsuCourseMemberSchema", () => {
  it("accepts a valid enrollment", () => {
    const result = enrollIsuCourseMemberSchema.safeParse({
      courseId: 1,
      memberId: 10,
      enrolledOn: "2026-06-14",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid date", () => {
    const result = enrollIsuCourseMemberSchema.safeParse({
      courseId: 1,
      memberId: 10,
      enrolledOn: "bad-date",
    });

    expect(result.success).toBe(false);
  });
});

describe("dropIsuCourseMemberSchema", () => {
  it("accepts a valid enrollment id", () => {
    const result = dropIsuCourseMemberSchema.safeParse({ enrollmentId: 1 });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the validation test and verify it fails**

Run:

```bash
cd app
npx vitest run tests/unit/education-isu-courses.test.ts
```

Expected: fails because `@/lib/validations/education-isu-courses` does not exist.

- [ ] **Step 3: Add the validation schemas**

Create `app/src/lib/validations/education-isu-courses.ts`:

```ts
import { z } from "zod";

const optionalText = z.string().trim().optional().transform((value) => value || undefined);

export const createIsuCourseCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(120),
  slug: z.string().trim().min(1, "Slug is required").max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by dashes"),
  description: optionalText,
  orderIndex: z.number().int().min(0).default(0),
});

export const updateIsuCourseCategorySchema = createIsuCourseCategorySchema.extend({
  categoryId: z.number().int().positive("Category is required"),
  isActive: z.boolean().default(true),
});

export const createIsuCourseSchema = z.object({
  categoryId: z.number().int().positive("Category is required"),
  title: z.string().trim().min(1, "Course title is required").max(200),
  description: optionalText,
  orderIndex: z.number().int().min(0).default(0),
});

export const updateIsuCourseSchema = createIsuCourseSchema.extend({
  courseId: z.number().int().positive("Course is required"),
  isActive: z.boolean().default(true),
});

export const enrollIsuCourseMemberSchema = z.object({
  courseId: z.number().int().positive("Course is required"),
  memberId: z.number().int().positive("Member is required"),
  enrolledOn: z.string().date("Invalid date"),
});

export const dropIsuCourseMemberSchema = z.object({
  enrollmentId: z.number().int().positive("Enrollment is required"),
});

export type CreateIsuCourseCategoryInput = z.infer<typeof createIsuCourseCategorySchema>;
export type UpdateIsuCourseCategoryInput = z.infer<typeof updateIsuCourseCategorySchema>;
export type CreateIsuCourseInput = z.infer<typeof createIsuCourseSchema>;
export type UpdateIsuCourseInput = z.infer<typeof updateIsuCourseSchema>;
export type EnrollIsuCourseMemberInput = z.infer<typeof enrollIsuCourseMemberSchema>;
export type DropIsuCourseMemberInput = z.infer<typeof dropIsuCourseMemberSchema>;
```

- [ ] **Step 4: Run validation tests**

Run:

```bash
cd app
npx vitest run tests/unit/education-isu-courses.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit validation**

Run:

```bash
git add app/src/lib/validations/education-isu-courses.ts app/tests/unit/education-isu-courses.test.ts
git commit -m "test: add ISU course validation"
```

---

## Task 2: Database and Drizzle Schema

**Files:**
- Create: `db/migrations/V076__education_isu_course_catalog.sql`
- Modify: `app/src/schema/education.ts`

- [ ] **Step 1: Add the Flyway migration**

Create `db/migrations/V076__education_isu_course_catalog.sql`:

```sql
CREATE TYPE education.isu_course_enrollment_status AS ENUM ('ENROLLED', 'DROPPED', 'COMPLETED');

CREATE TABLE education.isu_course_category (
  category_id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE education.isu_course (
  course_id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES education.isu_course_category(category_id),
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT isu_course_category_title_unique UNIQUE (category_id, title)
);

CREATE TABLE education.isu_course_enrollment (
  enrollment_id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES education.isu_course(course_id),
  member_id BIGINT NOT NULL REFERENCES membership.member(member_id),
  enrolled_on DATE NOT NULL,
  status education.isu_course_enrollment_status NOT NULL DEFAULT 'ENROLLED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT isu_course_enrollment_course_member_unique UNIQUE (course_id, member_id)
);

CREATE INDEX idx_isu_course_category_active_order ON education.isu_course_category(is_active, order_index);
CREATE INDEX idx_isu_course_category ON education.isu_course(category_id);
CREATE INDEX idx_isu_course_active_order ON education.isu_course(is_active, order_index);
CREATE INDEX idx_isu_course_enrollment_course ON education.isu_course_enrollment(course_id);
CREATE INDEX idx_isu_course_enrollment_member ON education.isu_course_enrollment(member_id);
CREATE INDEX idx_isu_course_enrollment_status ON education.isu_course_enrollment(status);

CREATE TRIGGER trg_isu_course_category_updated_at
  BEFORE UPDATE ON education.isu_course_category
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_isu_course_updated_at
  BEFORE UPDATE ON education.isu_course
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_isu_course_enrollment_updated_at
  BEFORE UPDATE ON education.isu_course_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO education.isu_course_category (name, slug, description, order_index)
VALUES
  ('Basic', 'basic', 'Entry-level ISU courses.', 1),
  ('Advance', 'advance', 'Advanced ISU courses.', 2),
  ('Paid Courses', 'paid-courses', 'Paid ISU courses. Payment is handled outside this app for now.', 3)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE education.isu_course_category IS 'Future-proof ISU course categories such as Basic, Advance, and Paid Courses.';
COMMENT ON TABLE education.isu_course IS 'ISU course catalog entries grouped by category.';
COMMENT ON TABLE education.isu_course_enrollment IS 'Registered member enrollment in an ISU course.';
```

- [ ] **Step 2: Add Drizzle schema exports**

Modify `app/src/schema/education.ts`:

```ts
export const isuCourseEnrollmentStatusEnum = educationSchema.enum("isu_course_enrollment_status", [
  "ENROLLED",
  "DROPPED",
  "COMPLETED",
]);

export const isuCourseCategory = educationSchema.table("isu_course_category", {
  categoryId: bigserial("category_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const isuCourse = educationSchema.table("isu_course", {
  courseId: bigserial("course_id", { mode: "number" }).primaryKey(),
  categoryId: bigint("category_id", { mode: "number" }).notNull().references(() => isuCourseCategory.categoryId),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const isuCourseEnrollment = educationSchema.table("isu_course_enrollment", {
  enrollmentId: bigserial("enrollment_id", { mode: "number" }).primaryKey(),
  courseId: bigint("course_id", { mode: "number" }).notNull().references(() => isuCourse.courseId),
  memberId: bigint("member_id", { mode: "number" }).notNull().references(() => member.memberId),
  enrolledOn: date("enrolled_on").notNull(),
  status: isuCourseEnrollmentStatusEnum("status").notNull().default("ENROLLED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

Place these after the existing ISU tables or directly before `isuTrack` with a clear `// ISU course catalog tables` comment.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected: no new errors from `education.ts`. If unrelated pre-existing errors appear, capture them separately and do not fix unrelated work in this task.

- [ ] **Step 4: Commit database and schema**

Run:

```bash
git add db/migrations/V076__education_isu_course_catalog.sql app/src/schema/education.ts
git commit -m "feat(db): add ISU course catalog tables"
```

---

## Task 3: Server Actions

**Files:**
- Create: `app/src/actions/education-isu-courses.ts`

- [ ] **Step 1: Add server actions**

Create `app/src/actions/education-isu-courses.ts`:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz-server";
import { isuCourse, isuCourseCategory, isuCourseEnrollment } from "@/schema/education";
import {
  createIsuCourseSchema,
  dropIsuCourseMemberSchema,
  enrollIsuCourseMemberSchema,
  updateIsuCourseSchema,
} from "@/lib/validations/education-isu-courses";

function formNumber(formData: FormData, key: string) {
  return Number(formData.get(key));
}

function formText(formData: FormData, key: string) {
  return (formData.get(key) as string | null) ?? "";
}

export async function createIsuCourse(formData: FormData) {
  await requireRole("ADMIN");

  const parsed = createIsuCourseSchema.safeParse({
    categoryId: formNumber(formData, "categoryId"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    orderIndex: formNumber(formData, "orderIndex"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db.insert(isuCourse).values({
      categoryId: parsed.data.categoryId as unknown as number,
      title: parsed.data.title,
      description: parsed.data.description,
      orderIndex: parsed.data.orderIndex,
    });
  } catch {
    return { error: "Course already exists in this category" };
  }

  revalidatePath("/education/isu/courses");
  redirect("/education/isu/courses");
}

export async function updateIsuCourse(formData: FormData) {
  await requireRole("ADMIN");

  const parsed = updateIsuCourseSchema.safeParse({
    courseId: formNumber(formData, "courseId"),
    categoryId: formNumber(formData, "categoryId"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    orderIndex: formNumber(formData, "orderIndex"),
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db
    .update(isuCourse)
    .set({
      categoryId: parsed.data.categoryId as unknown as number,
      title: parsed.data.title,
      description: parsed.data.description,
      orderIndex: parsed.data.orderIndex,
      isActive: parsed.data.isActive,
    })
    .where(eq(isuCourse.courseId, parsed.data.courseId));

  revalidatePath("/education/isu/courses");
  revalidatePath(`/education/isu/courses/${parsed.data.courseId}`);
}

export async function deactivateIsuCourse(courseId: number) {
  await requireRole("ADMIN");

  await db
    .update(isuCourse)
    .set({ isActive: false })
    .where(eq(isuCourse.courseId, courseId));

  revalidatePath("/education/isu/courses");
}

export async function enrollIsuCourseMember(courseId: number, formData: FormData) {
  await requireRole("ADMIN");

  const parsed = enrollIsuCourseMemberSchema.safeParse({
    courseId,
    memberId: formNumber(formData, "memberId"),
    enrolledOn: formText(formData, "enrolledOn"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const [course] = await db
    .select({ courseId: isuCourse.courseId })
    .from(isuCourse)
    .innerJoin(isuCourseCategory, eq(isuCourse.categoryId, isuCourseCategory.categoryId))
    .where(and(
      eq(isuCourse.courseId, parsed.data.courseId),
      eq(isuCourse.isActive, true),
      eq(isuCourseCategory.isActive, true),
    ));

  if (!course) return { error: "Course is not available for enrollment" };

  try {
    await db.insert(isuCourseEnrollment).values({
      courseId: parsed.data.courseId as unknown as number,
      memberId: parsed.data.memberId as unknown as number,
      enrolledOn: parsed.data.enrolledOn,
      status: "ENROLLED",
    }).onConflictDoUpdate({
      target: [isuCourseEnrollment.courseId, isuCourseEnrollment.memberId],
      set: {
        enrolledOn: parsed.data.enrolledOn,
        status: "ENROLLED",
      },
    });
  } catch {
    return { error: "Member could not be enrolled in this course" };
  }

  revalidatePath(`/education/isu/courses/${courseId}`);
  redirect(`/education/isu/courses/${courseId}`);
}

export async function dropIsuCourseMember(courseId: number, enrollmentId: number) {
  await requireRole("ADMIN");

  const parsed = dropIsuCourseMemberSchema.safeParse({ enrollmentId });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await db
    .update(isuCourseEnrollment)
    .set({ status: "DROPPED" })
    .where(eq(isuCourseEnrollment.enrollmentId, parsed.data.enrollmentId));

  revalidatePath(`/education/isu/courses/${courseId}`);
}
```

- [ ] **Step 2: Typecheck server actions**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected: no new errors from `education-isu-courses.ts`. Fix only errors caused by this file.

- [ ] **Step 3: Commit server actions**

Run:

```bash
git add app/src/actions/education-isu-courses.ts
git commit -m "feat: add ISU course server actions"
```

---

## Task 4: Course Catalog Page

**Files:**
- Create: `app/src/app/(admin)/education/isu/courses/page.tsx`
- Modify: `app/src/app/(admin)/education/isu/students/page.tsx`

- [ ] **Step 1: Create the catalog page**

Create `app/src/app/(admin)/education/isu/courses/page.tsx`:

```tsx
import Link from "next/link";
import { count, eq, asc, and } from "drizzle-orm";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz-server";
import { createIsuCourse, deactivateIsuCourse } from "@/actions/education-isu-courses";
import { isuCourse, isuCourseCategory, isuCourseEnrollment } from "@/schema/education";

export const dynamic = "force-dynamic";

export default async function IsuCoursesPage() {
  await requireRole("ADMIN");

  const categories = await db
    .select({
      categoryId: isuCourseCategory.categoryId,
      name: isuCourseCategory.name,
      description: isuCourseCategory.description,
    })
    .from(isuCourseCategory)
    .where(eq(isuCourseCategory.isActive, true))
    .orderBy(asc(isuCourseCategory.orderIndex), asc(isuCourseCategory.name));

  const courses = await db
    .select({
      courseId: isuCourse.courseId,
      categoryId: isuCourse.categoryId,
      title: isuCourse.title,
      description: isuCourse.description,
      enrolledCount: count(isuCourseEnrollment.enrollmentId),
    })
    .from(isuCourse)
    .leftJoin(
      isuCourseEnrollment,
      and(
        eq(isuCourseEnrollment.courseId, isuCourse.courseId),
        eq(isuCourseEnrollment.status, "ENROLLED"),
      ),
    )
    .where(eq(isuCourse.isActive, true))
    .groupBy(isuCourse.courseId)
    .orderBy(asc(isuCourse.orderIndex), asc(isuCourse.title));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ISU Courses</h1>
          <p className="mt-1 text-sm text-gray-500">Manage International Success University courses and member enrollments.</p>
        </div>
        <Link href="/education/isu/students" className="text-sm font-medium text-blue-600 hover:underline">
          ISU students
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <form action={createIsuCourse as never} className="grid gap-3 md:grid-cols-[180px_1fr_1fr_100px_auto] md:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Category</span>
            <select name="categoryId" required className="w-full rounded-md border border-gray-300 px-3 py-2">
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Course name</span>
            <input name="title" required className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Description</span>
            <input name="description" className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Order</span>
            <input name="orderIndex" type="number" min="0" defaultValue="0" className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <button type="submit" title="Add course" className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-3 text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="space-y-5">
        {categories.map((category) => {
          const categoryCourses = courses.filter((course) => course.categoryId === category.categoryId);

          return (
            <section key={category.categoryId} className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{category.name}</h2>
                {category.description ? <p className="text-sm text-gray-500">{category.description}</p> : null}
              </div>
              {categoryCourses.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No courses yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Course</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Enrolled</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categoryCourses.map((course) => (
                        <tr key={course.courseId}>
                          <td className="px-4 py-3">
                            <Link href={`/education/isu/courses/${course.courseId}`} className="font-medium text-blue-600 hover:underline">{course.title}</Link>
                            {course.description ? <p className="text-xs text-gray-500">{course.description}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{course.enrolledCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link title="Edit course" href={`/education/isu/courses/${course.courseId}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <form action={deactivateIsuCourse.bind(null, course.courseId) as never}>
                                <button title="Deactivate course" type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add link from ISU students page**

Modify the bottom link block in `app/src/app/(admin)/education/isu/students/page.tsx` to include:

```tsx
<Link href="/education/isu/courses" className="text-sm text-blue-600 hover:underline">
  View courses →
</Link>
```

- [ ] **Step 3: Install icon dependency if missing**

Run:

```bash
cd app
npm ls lucide-react
```

Expected: if missing, replace icon imports with text buttons or add dependency only if the project already uses `lucide-react`. Do not add a new icon package just for this feature.

- [ ] **Step 4: Typecheck catalog page**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected: no new errors from the new page.

- [ ] **Step 5: Commit catalog page**

Run:

```bash
git add app/src/app/(admin)/education/isu/courses/page.tsx app/src/app/(admin)/education/isu/students/page.tsx
git commit -m "feat: add ISU course catalog page"
```

---

## Task 5: Course Enrollment Page

**Files:**
- Create: `app/src/app/(admin)/education/isu/courses/[id]/page.tsx`

- [ ] **Step 1: Create the enrollment management page**

Create `app/src/app/(admin)/education/isu/courses/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz-server";
import { enrollIsuCourseMember, dropIsuCourseMember } from "@/actions/education-isu-courses";
import { contactInfo, person } from "@/schema/core";
import { member } from "@/schema/membership";
import { users } from "@/schema/app";
import { isuCourse, isuCourseCategory, isuCourseEnrollment } from "@/schema/education";

export const dynamic = "force-dynamic";

export default async function IsuCourseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  await requireRole("ADMIN");

  const courseId = Number(params.id);
  const q = searchParams.q?.trim() ?? "";

  const [course] = await db
    .select({
      courseId: isuCourse.courseId,
      title: isuCourse.title,
      description: isuCourse.description,
      categoryName: isuCourseCategory.name,
    })
    .from(isuCourse)
    .innerJoin(isuCourseCategory, eq(isuCourse.categoryId, isuCourseCategory.categoryId))
    .where(eq(isuCourse.courseId, courseId));

  if (!course) {
    return (
      <div className="space-y-3">
        <Link href="/education/isu/courses" className="text-sm text-gray-500 hover:text-gray-900">← ISU Courses</Link>
        <p className="text-sm text-gray-500">Course not found.</p>
      </div>
    );
  }

  const enrollments = await db
    .select({
      enrollmentId: isuCourseEnrollment.enrollmentId,
      enrolledOn: isuCourseEnrollment.enrolledOn,
      memberId: member.memberId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: users.email,
    })
    .from(isuCourseEnrollment)
    .innerJoin(member, eq(isuCourseEnrollment.memberId, member.memberId))
    .innerJoin(person, eq(member.personId, person.personId))
    .innerJoin(users, eq(users.personId, person.personId))
    .where(and(eq(isuCourseEnrollment.courseId, courseId), eq(isuCourseEnrollment.status, "ENROLLED")))
    .orderBy(asc(person.lastName), asc(person.firstName));

  const memberSearch = q.length >= 2
    ? await db
        .select({
          memberId: member.memberId,
          firstName: person.firstName,
          lastName: person.lastName,
          email: users.email,
        })
        .from(member)
        .innerJoin(person, eq(member.personId, person.personId))
        .innerJoin(users, eq(users.personId, person.personId))
        .leftJoin(contactInfo, eq(contactInfo.personId, person.personId))
        .where(and(
          eq(member.status, "ACTIVE"),
          eq(users.isActive, true),
          or(
            ilike(person.firstName, `%${q}%`),
            ilike(person.lastName, `%${q}%`),
            ilike(users.email, `%${q}%`),
            ilike(contactInfo.value, `%${q}%`),
          ),
        ))
        .orderBy(asc(person.lastName), asc(person.firstName))
        .limit(20)
    : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/education/isu/courses" className="text-sm text-gray-500 hover:text-gray-900">← ISU Courses</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{course.title}</h1>
        <p className="text-sm text-gray-500">{course.categoryName}</p>
        {course.description ? <p className="mt-2 text-sm text-gray-600">{course.description}</p> : null}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <form className="flex gap-3">
          <input name="q" defaultValue={q} placeholder="Search member by name or email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Search</button>
        </form>

        {memberSearch.length > 0 ? (
          <div className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200">
            {memberSearch.map((candidate) => (
              <form key={candidate.memberId} action={enrollIsuCourseMember.bind(null, courseId) as never} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{candidate.firstName} {candidate.lastName}</p>
                  <p className="text-xs text-gray-500">{candidate.email}</p>
                </div>
                <input type="hidden" name="memberId" value={candidate.memberId} />
                <input type="hidden" name="enrolledOn" value={today} />
                <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Enroll</button>
              </form>
            ))}
          </div>
        ) : q.length >= 2 ? (
          <p className="mt-3 text-sm text-gray-500">No registered members found.</p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Type at least 2 characters to search registered app members.</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Enrolled members ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">No members enrolled yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Member</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Enrolled on</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.enrollmentId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{enrollment.firstName} {enrollment.lastName}</p>
                      <p className="text-xs text-gray-500">{enrollment.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{enrollment.enrolledOn}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={dropIsuCourseMember.bind(null, courseId, enrollment.enrollmentId) as never}>
                        <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Drop</button>
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

- [ ] **Step 2: Typecheck enrollment page**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected: no new errors from the detail page.

- [ ] **Step 3: Commit enrollment page**

Run:

```bash
git add app/src/app/(admin)/education/isu/courses/[id]/page.tsx
git commit -m "feat: manage ISU course enrollments"
```

---

## Task 6: Final Verification

**Files:**
- No new files unless verification reveals defects in the feature files.

- [ ] **Step 1: Run lint**

Run:

```bash
cd app
npm run lint
```

Expected: pass.

- [ ] **Step 2: Run targeted unit tests**

Run:

```bash
cd app
npx vitest run tests/unit/education-isu.test.ts tests/unit/education-isu-courses.test.ts
```

Expected: pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected: pass or only report pre-existing unrelated errors already documented before this feature. Fix feature-caused errors.

- [ ] **Step 4: Inspect working tree**

Run:

```bash
git status --short
```

Expected: only intentional files from this plan are changed. Do not stage unrelated ministry-dashboard or ministry-leaders files.

- [ ] **Step 5: Commit verification fixes if any**

If verification required fixes, run:

```bash
git add <only-files-from-this-feature>
git commit -m "fix: polish ISU course catalog"
```

Expected: final feature commits are clean and unrelated working-tree changes remain untouched.

---

## Self-Review

- Spec coverage: The plan covers future-proof categories, Basic/Advance/Paid seed records, course add/edit/deactivate data paths, registered-member enrollment, Admin/Super Admin access via `requireRole("ADMIN")`, and preservation of enrollment history through soft status changes.
- Red-flag scan: No unfinished TBD/TODO markers are intentionally left in this plan.
- Type consistency: Table names and field names match the spec and the proposed Drizzle exports.
