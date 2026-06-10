# Plan 12 — Member Self-Service Portal

## Overview

Read-only public portal where members view their own church record via a secure token link. Staff copies the link from the admin member detail page and shares it (email, WhatsApp, etc.). No new auth system required.

## Scope

| # | Deliverable |
|---|-------------|
| 1 | `PORTAL_SECRET` env var + token encode/decode utility |
| 2 | `/portal/[token]` page — public, no auth |
| 3 | "Copy portal link" button on `/members/[id]` (admin) |
| 4 | Apply for regular membership from portal (if eligible) |
| 5 | Unit tests for token utility + Zod schemas |
| 6 | E2E tests for portal page |

## Token Design

```
token = base64url( memberId + "." + HMAC-SHA256(memberId, PORTAL_SECRET) )
```

- Encode: `lib/portal-token.ts` — `encodePortalToken(memberId)` → string
- Decode: `decodePortalToken(token)` → `memberId | null` (null = invalid/tampered)
- Secret: `process.env.PORTAL_SECRET` (add to `.env.example`)
- No expiry — staff can revoke by rotating secret (acceptable for MVP)

## Portal Page — `/portal/[token]`

Public route (no NextAuth). Decodes token → looks up member. Shows:

### Member Identity Section
- Full name, member code, status badge (ACTIVE / INACTIVE / PENDING)
- Branch name
- Lifecycle stage

### Roles Section
- Active roles with start date
- "No roles assigned" if empty

### Pastoral Care Section
- Assigned PCM name + assignment date
- "No PCM assigned" if empty

### Regular Member Application Section
- If application exists: status badge (PENDING / APPROVED / REJECTED / WITHDRAWN) + submitted date
- If no application AND member is eligible (status = ACTIVE, lifecycle = REGULAR_MEMBER or higher): **"Apply for Regular Membership"** button → server action → submit application → revalidate
- If not eligible: nothing shown

### Recent Event Registrations Section
- Last 10 registrations: event name, date, status badge
- Empty state: "No event registrations yet."

### Error States
- Invalid/tampered token → "This link is invalid."
- Member not found → "Member record not found."

## Admin Side — Copy Portal Link

On `/members/[id]` page, add a "Portal Link" section below the existing sections:
- Shows the portal URL (read-only text input)
- "Copy link" button (client component — `navigator.clipboard.writeText`)
- No new DB column needed — link is always computable from memberId

## Server Actions

`app/src/actions/portal.ts`:
- `submitApplicationFromPortal(memberId)` — reuses `submitApplication` logic from `membership-extensions.ts`, but takes memberId directly (not from session). Guard: member must be ACTIVE, no existing PENDING/APPROVED application.

## Zod Schemas

`app/src/lib/validations/portal.ts`:
- `portalTokenSchema` — string, min 10 chars (basic format check)

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/src/lib/portal-token.ts` | Create — encode/decode utilities |
| `app/src/lib/validations/portal.ts` | Create — Zod schemas |
| `app/src/actions/portal.ts` | Create — submitApplicationFromPortal |
| `app/src/app/portal/[token]/page.tsx` | Create — public portal page |
| `app/src/app/portal/[token]/CopyLinkButton.tsx` | NOT needed here — copy button is on admin side |
| `app/src/app/(admin)/members/[id]/PortalLinkSection.tsx` | Create — client component for copy button |
| `app/src/app/(admin)/members/[id]/page.tsx` | Modify — add PortalLinkSection |
| `app/.env.example` | Modify — add PORTAL_SECRET |
| `app/tests/unit/portal.test.ts` | Create — token encode/decode + Zod |
| `app/tests/e2e/portal.spec.ts` | Create — E2E tests |

## Unit Tests (target: ~20 tests)

`portal.test.ts`:
- `encodePortalToken` returns non-empty string
- `decodePortalToken` round-trips correctly
- `decodePortalToken` returns null for tampered token
- `decodePortalToken` returns null for garbage input
- `decodePortalToken` returns null for empty string
- `portalTokenSchema` accepts valid token string
- `portalTokenSchema` rejects empty string

## E2E Tests (target: 5 tests)

`portal.spec.ts`:
- Invalid token shows error message
- Valid token shows member name
- Valid token shows roles section
- Valid token shows application section (status or apply button)
- Valid token shows event registrations section

## Tasks

### Task 1 — Token utility + Zod + unit tests
Files: `lib/portal-token.ts`, `lib/validations/portal.ts`, `tests/unit/portal.test.ts`

### Task 2 — Server action
Files: `actions/portal.ts`

### Task 3 — Portal page `/portal/[token]`
Files: `app/portal/[token]/page.tsx`

### Task 4 — Admin PortalLinkSection + wire into member detail
Files: `(admin)/members/[id]/PortalLinkSection.tsx`, modify `(admin)/members/[id]/page.tsx`

### Task 5 — E2E tests
Files: `tests/e2e/portal.spec.ts`

## No DB Migration Needed

Token is computed from existing `member_id`. No new columns.

## Env Var

```
# .env.example addition
PORTAL_SECRET=replace-with-32-char-random-string
```

Local dev `.env`:
```
PORTAL_SECRET=jlycc-portal-secret-32chars-okk
```
