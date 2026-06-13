# ISU Course Catalog and Enrollment — Design Spec

**Date:** 2026-06-14
**Status:** Approved for spec review

---

## Overview

Add course management to the International Success University (ISU) area of the Education module. Admins and Super Admins should be able to manage ISU course categories, add/edit/deactivate courses, and enroll registered app members into those courses.

The current ISU model uses learning tracks and student progression. This feature adds a course catalog and per-course enrollment without replacing the existing track/session model.

---

## Scope

| In scope | Out of scope |
|---|---|
| ISU course categories such as Basic, Advance, and Paid Courses | Payment processing for paid courses |
| Future-proof category records that can support more categories later | Public self-enrollment by members |
| ISU course add/edit/deactivate controls | Grades, certificates, and completion workflows |
| Registered app member search for enrollment | Non-member/person-only enrollment |
| Admin/Super Admin-only course and enrollment management | Changing the existing BC course offering model |

---

## Data Model

Add three new tables in the `education` schema.

### `education.isu_course_category`

Stores ISU course groups as data, not hard-coded UI labels.

Fields:
- `category_id`
- `name`
- `slug`
- `description`
- `order_index`
- `is_active`
- `created_at`
- `updated_at`

Seed starting records:
- Basic
- Advance
- Paid Courses

### `education.isu_course`

Stores courses under a category.

Fields:
- `course_id`
- `category_id`
- `title`
- `description`
- `order_index`
- `is_active`
- `created_at`
- `updated_at`

Rules:
- Active courses display on the ISU main content page.
- Deleting a course in the UI deactivates it instead of hard-deleting it.
- Existing enrollments remain preserved when a course is deactivated.

### `education.isu_course_enrollment`

Links a course to a registered app member.

Fields:
- `enrollment_id`
- `course_id`
- `member_id`
- `enrolled_on`
- `status`
- `created_at`
- `updated_at`

Status values:
- `ENROLLED`
- `DROPPED`
- `COMPLETED`

Rules:
- A member can only have one enrollment row per course.
- Only members linked to app users should be selectable in the enrollment UI.
- Removing a member from a course should mark the enrollment as `DROPPED`, not delete the row.

---

## Permissions

Course and enrollment management requires `ADMIN` or `SUPER_ADMIN`.

Allowed:
- Add course category
- Edit course category
- Deactivate course category
- Add course
- Edit course
- Deactivate course
- Enroll registered app members
- Drop/remove enrolled members from a course

Not allowed:
- Member, Ministry Head, and Network Head roles cannot manage ISU courses or enrollments unless their app role is also Admin or Super Admin.

---

## UI Design

The ISU content page should show course categories as sections.

Each category section includes:
- Category title
- Add course plus icon
- Ordered list/grid of courses

Each course row/card includes:
- Course title
- Optional description
- Enrolled member count
- Pencil icon for edit
- Trash icon for deactivate
- Link or button to manage enrolled members

Course management should use familiar controls:
- Plus icon for add
- Pencil icon for edit
- Trash icon for deactivate
- Confirmation before deactivation

The member enrollment view for a course includes:
- Course heading
- Searchable registered-member picker by name/email
- Enroll button
- Enrolled members list
- Drop/remove action per enrolled member

---

## Data Flow

1. Admin opens the ISU courses page.
2. Server loads active categories and active courses, ordered by `order_index`.
3. Admin creates or edits a course through server actions with validation.
4. Admin opens a course enrollment view.
5. Server loads enrolled members and available registered app members.
6. Admin enrolls a member into the course.
7. The app prevents duplicate active enrollment for the same course/member pair.
8. Admin can drop a member, preserving historical enrollment data.

---

## Error Handling

Expected errors should return friendly messages:
- Duplicate course title within the same category
- Missing course title
- Missing category
- Duplicate enrollment
- Member is not linked to a registered app user
- Course/category not found or inactive
- Unauthorized role

Redirect-style navigation should stay outside `try/catch` blocks so `NEXT_REDIRECT` is not swallowed.

---

## Testing

Unit tests:
- validation for category/course/enrollment inputs
- duplicate-safe helper behavior where practical
- permission helper coverage if new pure helpers are introduced

Type checks:
- Drizzle schema matches migrations
- server actions use typed schema exports

Manual verification:
- Admin can add, edit, and deactivate a course
- Admin can enroll a registered app member
- Duplicate enrollment shows an error
- Dropped members no longer appear as active enrollees
- Non-admin roles cannot access management actions

---

## Implementation Notes

Keep the feature separate from existing ISU tracks. Tracks continue to represent progression; courses represent catalog items that members can enroll in.

Prefer focused files:
- `app/src/actions/education-isu-courses.ts`
- `app/src/lib/validations/education-isu-courses.ts`
- additions to `app/src/schema/education.ts`
- new route(s) under `app/src/app/(admin)/education/isu/courses`

Avoid raw `personId` entry for enrollment. Use member search/select so Admins choose registered app members by name/email.
