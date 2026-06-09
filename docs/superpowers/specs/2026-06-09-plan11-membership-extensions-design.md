# JLY Church App — Plan 11: Membership Extensions Design

## Goal

Expose three remaining membership schema features as admin UI: member role assignments, pastoral care (PCM) assignments, and regular member applications. Staff can manage all three from the member detail page, and work a pending applications queue from a dedicated list page.

## Scope

**In scope (Plan 11):**
- Add `regularMemberApplication` Drizzle table to `membership.ts`
- `/members/applications` — pending applications queue with inline approve/reject/withdraw
- `/members/[id]` — extend with Roles, PCM, and Application sections (assign/end inline forms)
- New server actions: submitApplication, reviewApplication, assignRole, endRole, assignPcm, endPcm

**Out of scope:**
- `criteria_checklist` JSONB UI — skipped (YAGNI; decision_notes covers review rationale)
- Creating or editing `membership.role` lookup rows (seeded, read-only)
- Lifecycle stage history display
- Branch transfer workflow

---

## Architecture

### New Files

```
app/src/
├── lib/validations/
│   └── membership-extensions.ts        # Zod schemas for all 6 actions
├── actions/
│   └── membership-extensions.ts        # 6 server actions
└── app/(admin)/
    └── members/
        └── applications/
            └── page.tsx                # Applications queue
```

### Modified Files

```
app/src/schema/membership.ts            # Add applicationStatusEnum + regularMemberApplication
app/src/app/(admin)/members/[id]/page.tsx  # Add Roles, PCM, Application sections
```

### No New Migrations

All tables already exist: V020 (member_role), V021 (regular_member_application), V022 (pastoral_care_assignment).

---

## Schema Addition (`schema/membership.ts`)

Append to existing file after `pastoralCareAssignment`:

```typescript
export const applicationStatusEnum = membershipSchema.enum("application_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
]);

export const regularMemberApplication = membershipSchema.table(
  "regular_member_application",
  {
    applicationId: bigserial("application_id", { mode: "number" }).primaryKey(),
    memberId: bigint("member_id", { mode: "number" })
      .notNull()
      .references(() => member.memberId, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByPersonId: bigint("reviewed_by_person_id", { mode: "number" }),
    status: applicationStatusEnum("status").notNull().default("PENDING"),
    criteriaChecklist: jsonb("criteria_checklist").notNull().default({}),
    decisionNotes: text("decision_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
  }
);
```

Add `jsonb` to the `drizzle-orm/pg-core` import.

---

## Zod Schemas (`lib/validations/membership-extensions.ts`)

```typescript
export const submitApplicationSchema = z.object({
  memberId: z.number().int().positive(),
});

export const reviewApplicationSchema = z.object({
  applicationId: z.number().int().positive(),
  status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]),
  decisionNotes: z.string().optional(),
});

export const assignRoleSchema = z.object({
  memberId: z.number().int().positive(),
  roleId: z.number().int().positive(),
  assignedAt: z.string().date("Invalid date"),
  notes: z.string().optional(),
});

export const endRoleSchema = z.object({
  memberRoleId: z.number().int().positive(),
  endedAt: z.string().date("Invalid date"),
});

export const assignPcmSchema = z.object({
  carerMemberId: z.number().int().positive(),
  assignedMemberId: z.number().int().positive(),
  assignedAt: z.string().date("Invalid date"),
  notes: z.string().optional(),
});

export const endPcmSchema = z.object({
  assignmentId: z.number().int().positive(),
  endedAt: z.string().date("Invalid date"),
});
```

---

## Server Actions (`actions/membership-extensions.ts`)

All return `{ success: true } | { error: string }`. Business guards before try, DB ops inside try.

| Action | Guard | DB op | Revalidate |
|--------|-------|-------|------------|
| `submitApplication(memberId)` | No existing PENDING app for member | Insert regularMemberApplication | `/members/${memberId}`, `/members/applications` |
| `reviewApplication(applicationId, status, notes?)` | Application exists + is PENDING | Update status + reviewedAt + decisionNotes | `/members/applications` + member detail via memberId lookup |
| `assignRole(data)` | None (stackable) | Insert memberRole | `/members/${memberId}` |
| `endRole(memberRoleId, endedAt)` | Role exists + `endedAt` is null | Update `endedAt` | `/members/${memberId}` via lookup |
| `assignPcm(data)` | No active PCM for assignedMemberId; carer ≠ assigned | Insert pastoralCareAssignment | `/members/${assignedMemberId}` |
| `endPcm(assignmentId, endedAt)` | Assignment exists + `endedAt` is null | Update `endedAt` + `status = ENDED` | `/members/${assignedMemberId}` via lookup |

---

## Pages

### `/members/applications` — Applications Queue

- `export const dynamic = "force-dynamic"`
- Query all PENDING applications joined to member → person for name + memberCode
- Table: Member name, memberCode, submittedAt
- Per-row inline forms (3 buttons): Approve / Reject / Withdraw
  - Approve/Reject show a small decisionNotes textarea before submit
  - Withdraw is immediate (no notes required)
- Empty state: "No pending applications."
- Nav: add "Applications" link under Members in admin layout (or as sub-link)

### `/members/[id]` — Member Detail Extensions

Three new sections appended below existing content:

**Roles section**
- Heading: "Roles"
- Active roles listed (name + assignedAt). Each row has "End" button (hidden endedAt = today)
- "Assign role" inline form: role `<select>` (all active seeded roles), assignedAt date input (default today), optional notes textarea, submit button

**PCM section**
- Heading: "Pastoral Care"
- If active assignment: show carer name + memberCode + assignedAt + "End" button
- If no active assignment: "Assign PCM" form — carerMemberId number input, assignedAt date (default today), optional notes
- Error display if `pcmErr` searchParam set

**Application section**
- Heading: "Regular Member Application"
- If approved: show green "Approved" badge + approvedAt date
- If pending: show amber "Pending review" badge + submittedAt
- If rejected/withdrawn: show status + decisionNotes
- If none: "Submit application" button (single-click form, no fields)

---

## Testing

### Unit Tests (`tests/unit/membership-extensions.test.ts`)

- `submitApplicationSchema`: valid memberId, rejects missing memberId, rejects non-positive
- `reviewApplicationSchema`: valid APPROVED with notes, valid WITHDRAWN without notes, rejects PENDING as status, rejects missing applicationId
- `assignRoleSchema`: valid, rejects invalid date, rejects missing roleId
- `endRoleSchema`: valid, rejects invalid date
- `assignPcmSchema`: valid, rejects missing carerMemberId, rejects invalid date
- `endPcmSchema`: valid, rejects missing assignmentId

### E2E Tests (`tests/e2e/membership-extensions.spec.ts`)

- Applications queue page loads at `/members/applications`
- Member detail page has Roles section
- Member detail page has Pastoral Care section
- Member detail page has Regular Member Application section
- Assign role form visible on member detail
- Submit application button visible on member detail (if no existing application)

---

## Notes

- `criteria_checklist` JSONB is always stored as `{}` — no UI for it (YAGNI)
- `memberRole` is stackable — no uniqueness constraint; a member can hold multiple roles simultaneously
- `pastoralCareAssignment` has DB-level partial unique index: one active PCM per assigned member — server action guard enforces this before insert with a readable error
- `regularMemberApplication` has DB-level partial unique index: one PENDING per member — server action guard enforces this
- `assignedAt` on roles and PCM is a date field in forms, stored as timestamp (convert with `new Date(value)`)
- `endedAt` on roles and PCM: same pattern — stored as timestamp, form submits date string
