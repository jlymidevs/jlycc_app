# JLY Church App — Plan 9: Ministries Admin Module Design

## Goal

Add a staff-facing ministries admin module at `/ministries`. Staff can browse ministries grouped by network (read-only), manage chapters (which ministry runs at which branch), and manage chapter membership (enroll members, end membership, assign leader roles).

## Scope

**In scope (Plan 9):**
- `/ministries` — ministry list grouped by network (read-only)
- `/ministries/[id]` — ministry detail + chapters list + create chapter
- `/ministries/[id]/chapters/[cid]` — chapter detail + active members + add/end/set leader role
- Admin nav link "Ministries"

**Out of scope:**
- Creating or editing networks/ministries (seeded, static org structure)
- Public-facing ministry pages
- Member self-enrollment
- Historical membership reporting

---

## Architecture

### New Files

```
app/src/
├── schema/
│   └── ministries.ts                        # Drizzle: network, ministry, chapter, membership
├── lib/validations/
│   └── ministries.ts                        # Zod: createChapterSchema, addMemberSchema, endMemberSchema
├── actions/
│   └── ministries.ts                        # Server actions
└── app/(admin)/
    └── ministries/
        ├── page.tsx                          # Ministry list grouped by network
        └── [id]/
            ├── page.tsx                      # Ministry detail + chapters
            └── chapters/
                └── [cid]/
                    └── page.tsx              # Chapter detail + members
```

### Modified Files

```
app/src/app/(admin)/layout.tsx               # Add "Ministries" nav link
```

### No New Migrations

All tables already exist: V029 (network), V030 (ministry), V031 (ministry_chapter), V032 (ministry_membership).

---

## Drizzle Schema (`schema/ministries.ts`)

Mirrors V029–V032:

```typescript
export const ministriesSchema = pgSchema("ministries");

export const chapterStatusEnum = ministriesSchema.enum("chapter_status", ["ACTIVE", "PAUSED", "CLOSED"]);
export const leaderRoleEnum = ministriesSchema.enum("leader_role", ["HEAD", "ASSISTANT_HEAD", "COORDINATOR"]);

export const network = ministriesSchema.table("network", {
  networkId: bigserial("network_id", { mode: "bigint" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministry = ministriesSchema.table("ministry", {
  ministryId: bigserial("ministry_id", { mode: "bigint" }).primaryKey(),
  networkId: bigint("network_id", { mode: "bigint" }).notNull().references(() => network.networkId),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  targetDemographic: text("target_demographic"),
  foundedOn: date("founded_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministryChapter = ministriesSchema.table("ministry_chapter", {
  chapterId: bigserial("chapter_id", { mode: "bigint" }).primaryKey(),
  ministryId: bigint("ministry_id", { mode: "bigint" }).notNull().references(() => ministry.ministryId),
  branchId: bigint("branch_id", { mode: "bigint" }).notNull(),
  launchedOn: date("launched_on"),
  status: chapterStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministryMembership = ministriesSchema.table("ministry_membership", {
  membershipId: bigserial("membership_id", { mode: "bigint" }).primaryKey(),
  chapterId: bigint("chapter_id", { mode: "bigint" }).notNull().references(() => ministryChapter.chapterId),
  memberId: bigint("member_id", { mode: "bigint" }).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedReason: text("ended_reason"),
  isLeader: boolean("is_leader").notNull().default(false),
  leaderRole: leaderRoleEnum("leader_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## Zod Schemas (`lib/validations/ministries.ts`)

```typescript
export const createChapterSchema = z.object({
  ministryId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  launchedOn: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]).default("ACTIVE"),
});

export const addMemberSchema = z.object({
  chapterId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  joinedAt: z.string().min(1, "Join date required"),
  isLeader: z.boolean().default(false),
  leaderRole: z.enum(["HEAD", "ASSISTANT_HEAD", "COORDINATOR"]).optional(),
}).refine(
  (d) => !d.isLeader || d.leaderRole != null,
  { message: "Leader role required when isLeader is true", path: ["leaderRole"] }
);

export const endMemberSchema = z.object({
  membershipId: z.number().int().positive(),
  endedAt: z.string().min(1, "End date required"),
  endedReason: z.string().optional(),
});
```

---

## Server Actions (`actions/ministries.ts`)

All return `{ success: true; ... } | { error: string }`. DB operations wrapped in try/catch.

| Action | Description |
|--------|-------------|
| `getMinistries()` | All ministries joined to network, ordered by network name then ministry name |
| `getMinistry(id)` | Single ministry + chapters joined to branch, with active member count per chapter |
| `createChapter(data)` | Validate unique ministry+branch constraint, insert chapter |
| `updateChapterStatus(chapterId, status)` | Update chapter status |
| `getChapter(id)` | Chapter + ministry name + branch name + active members (endedAt IS NULL) joined to member→person |
| `addMember(data)` | Check no active membership exists for member in chapter, insert |
| `endMembership(data)` | Set endedAt + endedReason on membership record |
| `setLeaderRole(membershipId, isLeader, leaderRole)` | Update isLeader + leaderRole fields |

---

## Pages

### `/ministries` — Ministry List

- `export const dynamic = "force-dynamic"`
- Groups ministries by network. Section header per network (Eagles / Wind / Lead Takers).
- Each ministry card: name, code badge, targetDemographic (if set), chapter count.
- Click card → `/ministries/[id]`
- No create/delete controls (networks/ministries are seeded).

### `/ministries/[id]` — Ministry Detail + Chapters

- `export const dynamic = "force-dynamic"`
- Header: ministry name, description, targetDemographic, foundedOn.
- Chapters table: branch name, status badge (ACTIVE=green / PAUSED=amber / CLOSED=gray), launchedOn, active member count, link to chapter detail.
- "New Chapter" form at bottom: branch dropdown (from `core.branch`), optional launchedOn date, status select defaulting to ACTIVE.
- Duplicate guard: if ministry+branch chapter already exists → show error message.

### `/ministries/[id]/chapters/[cid]` — Chapter Detail + Members

- `export const dynamic = "force-dynamic"`
- Header: ministry name → branch name, status badge.
- Status control: dropdown to change ACTIVE / PAUSED / CLOSED → calls `updateChapterStatus`.
- Active members table: member name, joinedAt, leader badge (shows role if isLeader), "End" button, "Set Leader" / "Remove Leader" button.
- "Add Member" section: member search by name/email (reuses `searchPersons` pattern from attendance), select result, joinedAt (default today), isLeader checkbox, leaderRole dropdown (shown only when isLeader checked).
- End membership: "End" button → inline form (endedAt datetime, optional reason) → calls `endMembership`.
- `setLeaderRole`: toggle button updates isLeader + leaderRole inline.

---

## Testing

### Unit Tests (`tests/unit/ministries.test.ts`)

- `createChapterSchema`: valid input, missing ministryId, missing branchId
- `addMemberSchema`: valid non-leader, valid leader with role, isLeader=true missing leaderRole → error, invalid chapterId
- `endMemberSchema`: valid, missing endedAt, missing membershipId

### E2E Tests (`tests/e2e/ministries.spec.ts`)

- Ministry list loads at `/ministries` with network section headers visible
- Click ministry → navigate to detail page with chapters section
- Chapter detail page loads (graceful skip if no chapters in DB)
- Add member form visible on chapter page (graceful skip if no chapters)

Graceful skip pattern: `if (await locator.count() === 0) { test.skip(); return; }`

---

## Notes

- `ministry_membership` is append-only: never delete rows, close by setting `endedAt`.
- `ministry_chapter` unique constraint `(ministry_id, branch_id)` enforced at DB level; server action checks before insert to return a readable error.
- `isLeader` / `leaderRole` constraint: `(isLeader=false AND leaderRole IS NULL) OR (isLeader=true AND leaderRole IS NOT NULL)` — enforced by Zod refine + DB CHECK constraint.
- Member search reuses the `searchPersons` pattern from `actions/attendance.ts` — no new search infrastructure needed.
