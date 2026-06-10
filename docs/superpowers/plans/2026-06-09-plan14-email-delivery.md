# Plan 14 — Email Delivery for Announcements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send emails to announcement recipients when an announcement is published, updating `delivered_at` per recipient on success.

**Architecture:** Install Resend SDK. Add `lib/email.ts` — thin wrapper with `sendAnnouncementEmail`. Modify `publishAnnouncement` to query member emails from `core.contact_info`, send via Resend in batches of 50, and update `delivered_at`. If `RESEND_API_KEY` is absent, skip sending (log only) so local dev and tests work without a key.

**Tech Stack:** `resend` npm package, Drizzle ORM, Next.js server actions, Vitest, Playwright.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/src/lib/email.ts` | Create — Resend client + `sendAnnouncementEmail` + `buildAnnouncementHtml` |
| `app/src/actions/announcements.ts` | Modify — call email delivery after fan-out in `publishAnnouncement` |
| `app/.env.example` | Modify — add `RESEND_API_KEY` and `RESEND_FROM` |
| `app/tests/unit/email.test.ts` | Create — unit tests for `buildAnnouncementHtml` |

No new DB migration needed — `announcement_recipient.delivered_at` already exists (V066).

---

## Task 1 — Install Resend + env vars

**Files:**
- Modify: `app/package.json` (via npm install)
- Modify: `app/.env.example`

- [ ] **Step 1: Install resend**

```bash
cd app && npm install resend
```

Expected output includes `added 1 package`.

- [ ] **Step 2: Add env vars to .env.example**

Open `app/.env.example` and append:

```
RESEND_API_KEY=re_replace_with_your_key
RESEND_FROM=noreply@yourdomain.com
```

- [ ] **Step 3: Add env vars to local .env (do NOT commit)**

Open `app/.env` and append:

```
RESEND_API_KEY=
RESEND_FROM=noreply@jly.church
```

Leave `RESEND_API_KEY` empty for local dev — the email utility skips sending when the key is absent.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/.env.example
git commit -m "chore: install resend, add email env vars"
```

---

## Task 2 — Email utility + unit tests

**Files:**
- Create: `app/src/lib/email.ts`
- Create: `app/tests/unit/email.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `app/tests/unit/email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAnnouncementHtml } from "@/lib/email";

describe("buildAnnouncementHtml", () => {
  it("includes the announcement title", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Sunday Service Update");
  });

  it("includes the announcement body", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Service starts at 9am.");
  });

  it("includes the recipient name", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Juan dela Cruz");
  });

  it("returns a non-empty string", () => {
    const html = buildAnnouncementHtml({
      title: "T",
      body: "B",
      recipientName: "N",
    });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("escapes HTML special chars in title", () => {
    const html = buildAnnouncementHtml({
      title: "<script>alert(1)</script>",
      body: "body",
      recipientName: "name",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML special chars in body", () => {
    const html = buildAnnouncementHtml({
      title: "title",
      body: "<b>bold</b>",
      recipientName: "name",
    });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("escapes HTML special chars in recipientName", () => {
    const html = buildAnnouncementHtml({
      title: "title",
      body: "body",
      recipientName: '<a href="#">hack</a>',
    });
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;a ");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npx vitest run tests/unit/email.test.ts
```

Expected: FAIL — `buildAnnouncementHtml` not found.

- [ ] **Step 3: Create email utility**

Create `app/src/lib/email.ts`:

```typescript
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM ?? "noreply@jly.church";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildAnnouncementHtml(params: {
  title: string;
  body: string;
  recipientName: string;
}): string {
  const { title, body, recipientName } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;color:#111">${escapeHtml(title)}</h1>
  <p style="color:#444">Dear ${escapeHtml(recipientName)},</p>
  <p style="color:#444;white-space:pre-wrap">${escapeHtml(body)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">JLY Church</p>
</body>
</html>`;
}

export async function sendAnnouncementEmail(params: {
  to: string;
  recipientName: string;
  title: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping send to ${params.to}`);
    return { success: true };
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.title,
    html: buildAnnouncementHtml({
      title: params.title,
      body: params.body,
      recipientName: params.recipientName,
    }),
  });

  if (error) {
    console.error(`[email] Failed to send to ${params.to}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd app && npx vitest run tests/unit/email.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 5: Run full unit suite — verify no regressions**

```bash
cd app && npx vitest run
```

Expected: all tests passing (209 + 7 = 216).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/email.ts app/tests/unit/email.test.ts
git commit -m "feat(email): add email utility with buildAnnouncementHtml and sendAnnouncementEmail"
```

---

## Task 3 — Wire email delivery into publishAnnouncement

**Files:**
- Modify: `app/src/actions/announcements.ts`

- [ ] **Step 1: Update publishAnnouncement to send emails**

Replace the full `publishAnnouncement` function in `app/src/actions/announcements.ts`. Add these imports at the top of the file:

```typescript
import { contactInfo } from "@/schema/core";
import { person } from "@/schema/core";
import { sendAnnouncementEmail } from "@/lib/email";
```

Then replace the `publishAnnouncement` function body (lines 36–97) with:

```typescript
export async function publishAnnouncement(
  id: number
): Promise<{ success: true; recipientCount: number; deliveredCount: number } | { error: string }> {
  const [row] = await db
    .select()
    .from(announcement)
    .where(eq(announcement.announcementId, id))
    .limit(1);

  if (!row) return { error: "Announcement not found" };
  if (row.status !== "DRAFT") return { error: "Only DRAFT announcements can be published" };

  // Fan out recipients
  let targetMembers: { personId: number }[] = [];

  if (row.targetType === "ALL_MEMBERS") {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(isNull(member.deletedAt));
  } else if (row.targetType === "BRANCH" && row.targetId) {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(and(
        eq(member.branchId, Number(row.targetId)),
        isNull(member.deletedAt)
      ));
  } else if (row.targetType === "LIFECYCLE_STAGE" && row.targetId) {
    targetMembers = await db
      .select({ personId: member.personId })
      .from(member)
      .where(and(
        eq(member.currentStage, row.targetId),
        isNull(member.deletedAt)
      ));
  }
  // MANUAL: no auto fan-out

  if (targetMembers.length > 0) {
    await db
      .insert(announcementRecipient)
      .values(
        targetMembers.map((m) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          announcementId: id as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personId: m.personId as any,
        }))
      )
      .onConflictDoNothing();
  }

  await db
    .update(announcement)
    .set({ status: "PUBLISHED", publishedAt: new Date() })
    .where(eq(announcement.announcementId, id));

  // Fetch recipients with their primary email and name
  const recipientsWithEmail = await db
    .select({
      recipientId: announcementRecipient.recipientId,
      personId: announcementRecipient.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: contactInfo.value,
    })
    .from(announcementRecipient)
    .innerJoin(person, eq(announcementRecipient.personId, person.personId))
    .innerJoin(
      contactInfo,
      and(
        eq(contactInfo.personId, announcementRecipient.personId),
        eq(contactInfo.type, "EMAIL"),
        eq(contactInfo.isPrimary, true)
      )
    )
    .where(eq(announcementRecipient.announcementId, id));

  // Send in batches of 50
  let deliveredCount = 0;
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipientsWithEmail.length; i += BATCH_SIZE) {
    const batch = recipientsWithEmail.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (r) => {
        const result = await sendAnnouncementEmail({
          to: r.email,
          recipientName: `${r.firstName} ${r.lastName}`.trim(),
          title: row.title,
          body: row.body,
        });
        if (result.success) {
          await db
            .update(announcementRecipient)
            .set({ deliveredAt: new Date() })
            .where(eq(announcementRecipient.recipientId, r.recipientId));
          deliveredCount++;
        }
      })
    );
  }

  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { success: true, recipientCount: targetMembers.length, deliveredCount };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run unit tests — verify no regressions**

```bash
cd app && npx vitest run
```

Expected: 216 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/src/actions/announcements.ts
git commit -m "feat(email): send emails on announcement publish, update delivered_at"
```

---

## Task 4 — Show delivery status on detail page

**Files:**
- Modify: `app/src/app/(admin)/announcements/[id]/page.tsx`

- [ ] **Step 1: Update detail page to show delivered count**

In `app/src/app/(admin)/announcements/[id]/page.tsx`, add a "Delivered" row to the `<dl>` in the Details section. Find this block:

```tsx
          <dt className="text-gray-500">Recipients</dt>
          <dd className="text-gray-900">{row.recipientCount}</dd>
```

Replace with:

```tsx
          <dt className="text-gray-500">Recipients</dt>
          <dd className="text-gray-900">{row.recipientCount}</dd>
          {row.status === "PUBLISHED" && (
            <>
              <dt className="text-gray-500">Delivered</dt>
              <dd className="text-gray-900">{deliveredCount}</dd>
            </>
          )}
```

Then compute `deliveredCount` by adding this query after the `recipients` query near the top of the component:

```typescript
  const [{ deliveredCount }] = await db
    .select({ deliveredCount: count() })
    .from(announcementRecipient)
    .where(
      and(
        eq(announcementRecipient.announcementId, id),
        isNotNull(announcementRecipient.deliveredAt)
      )
    );
```

Add `isNotNull` to the import from `drizzle-orm`:
```typescript
import { eq, isNotNull } from "drizzle-orm";
```

Also add `count` to the import from `drizzle-orm`:
```typescript
import { eq, isNotNull, count } from "drizzle-orm";
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/(admin)/announcements/[id]/page.tsx
git commit -m "feat(email): show delivered count on announcement detail page"
```

---

## Task 5 — E2E test: delivered_at gets set on publish

**Files:**
- Modify: `app/tests/e2e/announcements.spec.ts`

- [ ] **Step 1: Add delivery count assertion to existing publish test**

In `app/tests/e2e/announcements.spec.ts`, update the "staff can publish an announcement" test to also check that the Delivered row appears on the detail page (since `RESEND_API_KEY` is empty in test env, all sends are skipped but treated as success, so delivered count equals recipient count):

```typescript
  test("staff can publish an announcement", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Publish Test");
    await page.fill('textarea[name="body"]', "Publish body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    await expect(page).toHaveURL(/\/announcements\/\d+/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
    await expect(page.getByText("Delivered")).toBeVisible();
  });
```

- [ ] **Step 2: Run E2E tests**

```bash
cd app && npx playwright test tests/e2e/announcements.spec.ts --reporter=list
```

Expected: 5/5 passing.

- [ ] **Step 3: Run full unit suite — final check**

```bash
cd app && npx vitest run
```

Expected: 216 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/announcements.spec.ts
git commit -m "test(e2e): verify Delivered row appears after publish"
```

---

## No New DB Migration Needed

`announcement_recipient.delivered_at` already exists (added in V066).

## Env Vars Summary

| Var | Purpose | Required |
|-----|---------|----------|
| `RESEND_API_KEY` | Resend API key | No — skips sending if absent |
| `RESEND_FROM` | From address | No — defaults to `noreply@jly.church` |

## Notes

- Empty `RESEND_API_KEY` = skip sending, count as delivered. Safe for local dev and tests.
- Batch size 50 — stays within Resend rate limits on free tier.
- Members with no primary email are silently skipped (inner join excludes them).
- `delivered_at` only set on successful Resend API call (or when key is absent).
