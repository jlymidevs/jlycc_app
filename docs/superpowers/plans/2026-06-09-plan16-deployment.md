# Plan 16 — Deployment Prep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app production-deployable on Vercel + Neon PostgreSQL, with all admin routes properly secured.

**Architecture:** Fix middleware to protect all `/(admin)` routes. Provision Neon DB, run Flyway migrations against it, configure Vercel env vars, deploy. Google OAuth prod redirect URI must be updated in Google Cloud Console.

**Tech Stack:** Vercel, Neon (serverless PostgreSQL), Flyway (migrations), Next.js 14, NextAuth v5, Resend.

---

## Critical Bug: Middleware Only Protects /members and /events

All admin routes under `/(admin)/` except `/members` and `/events` are **publicly accessible without login** right now. This must be fixed before deployment.

Routes currently unprotected:
- `/programs`, `/programs/*`
- `/education`, `/education/*`
- `/ministries`, `/ministries/*`
- `/missions`, `/missions/*`
- `/announcements`, `/announcements/*`
- `/attendance`, `/attendance/*`
- `/bac`, `/bac/*`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/middleware.ts` | Modify — protect all admin routes |
| `app/.env.example` | Modify — add `NEXTAUTH_URL` |
| `app/next.config.mjs` | Modify — add `output: 'standalone'` (optional, improves Docker) |

No DB migration needed.

---

## Task 1 — Fix Middleware (Critical Security Fix)

**Files:**
- Modify: `app/middleware.ts`

- [ ] **Step 1: Read current middleware**

Open `app/middleware.ts`. Current content:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute =
    path.startsWith("/members") || path.startsWith("/events");
  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/members", "/members/:path*", "/events", "/events/:path*"],
};
```

- [ ] **Step 2: Replace with comprehensive admin route protection**

Replace the entire file with:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_PREFIXES = [
  "/members",
  "/events",
  "/programs",
  "/education",
  "/ministries",
  "/missions",
  "/announcements",
  "/attendance",
  "/bac",
];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = ADMIN_PREFIXES.some((prefix) =>
    path === prefix || path.startsWith(prefix + "/")
  );
  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: [
    "/members/:path*",
    "/events/:path*",
    "/programs/:path*",
    "/education/:path*",
    "/ministries/:path*",
    "/missions/:path*",
    "/announcements/:path*",
    "/attendance/:path*",
    "/bac/:path*",
  ],
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify login redirect works (manual)**

Start dev server: `cd app && npm run dev`

Open `http://localhost:3000/programs` in a browser without logging in.
Expected: redirect to `/login`.

Open `http://localhost:3000/announcements` without logging in.
Expected: redirect to `/login`.

Open `http://localhost:3000/portal/anything` without logging in.
Expected: page loads (portal is public — no redirect).

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/middleware.ts
git commit -m "fix(auth): protect all admin routes in middleware"
```

---

## Task 2 — Provision Neon Database

> **Human action required** — Claude cannot create a Neon account or provision a DB.

- [ ] **Step 1: Create Neon project**

1. Go to https://neon.tech and sign up (free tier is sufficient for a church app)
2. Create a new project — name it `jlycc` or similar
3. Select region closest to your users (e.g. Singapore `ap-southeast-1`)
4. Copy the **connection string** — looks like:
   ```
   postgresql://jlycc_owner:XXXX@ep-XXXX.ap-southeast-1.aws.neon.tech/jlycc?sslmode=require
   ```

- [ ] **Step 2: Create app_writer and app_reader roles**

In the Neon SQL Editor (or any psql client connected to Neon), run:

```sql
-- Create roles
CREATE ROLE app_writer WITH LOGIN PASSWORD 'choose-a-strong-password';
CREATE ROLE app_reader WITH LOGIN PASSWORD 'choose-a-strong-password';

-- Grant connect
GRANT CONNECT ON DATABASE neondb TO app_writer;
GRANT CONNECT ON DATABASE neondb TO app_reader;

-- Schema grants will be applied by Flyway after migrations run
-- For now, grant usage on public
GRANT USAGE ON SCHEMA public TO app_writer, app_reader;
```

Note: After Flyway creates all schemas, run:
```sql
GRANT USAGE ON SCHEMA core, membership, events, attendance, programs, education, ministries, missions, communications, app TO app_writer, app_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO app_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO app_reader;
-- Repeat for each schema
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO app_reader;
-- Repeat for each schema: membership, events, attendance, programs, education, ministries, missions, communications, app
```

- [ ] **Step 3: Run Flyway migrations against Neon**

Update `db/flyway.conf` temporarily with Neon credentials (do NOT commit):

```properties
flyway.url=jdbc:postgresql://ep-XXXX.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
flyway.user=neondb_owner
flyway.password=YOUR_NEON_PASSWORD
flyway.schemas=public,core,membership,events,attendance,programs,education,ministries,missions,communications,app
flyway.locations=filesystem:./migrations
```

Run Flyway:
```bash
cd db && docker run --rm \
  -v "$(pwd)/migrations:/flyway/sql" \
  -v "$(pwd)/flyway.conf:/flyway/conf/flyway.conf" \
  flyway/flyway:10 migrate
```

Or use the docker compose approach:
```bash
cd db && docker compose run flyway
```

Expected output: `Successfully applied 66 migrations`.

Revert `flyway.conf` to local dev values after migration.

- [ ] **Step 4: Create connection strings for app**

Writer URL (for `DATABASE_URL`):
```
postgresql://app_writer:PASSWORD@ep-XXXX.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Reader URL (for `DATABASE_URL_READER`):
```
postgresql://app_reader:PASSWORD@ep-XXXX.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Note: Neon also provides a **pooled connection string** (via PgBouncer). Use pooled for `DATABASE_URL` (writes go through pooler), unpooled for migrations.

---

## Task 3 — Configure Vercel

> **Human action required** — Claude cannot deploy to Vercel directly.

- [ ] **Step 1: Connect repo to Vercel**

1. Go to https://vercel.com and sign in
2. Import the `jlymidevs/jlycc_app` GitHub repo
3. Set **Root Directory** to `app` (the Next.js app is in the `app/` subfolder)
4. Framework preset: **Next.js** (auto-detected)
5. Do NOT deploy yet — set env vars first

- [ ] **Step 2: Set environment variables in Vercel**

In Vercel project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://app_writer:PWD@ep-XXXX.../neondb?sslmode=require` |
| `DATABASE_URL_READER` | `postgresql://app_reader:PWD@ep-XXXX.../neondb?sslmode=require` |
| `AUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `PORTAL_SECRET` | Generate with: `openssl rand -base64 32` |
| `RESEND_API_KEY` | `re_2BmLwfe9_AztbCKXi1XtmUWfJWnYwehc8` |
| `RESEND_FROM` | `noreply@yourdomain.com` (must be a verified Resend domain) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (if Google login needed) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (if Google login needed) |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (set after first deploy gives you the URL) |

- [ ] **Step 3: Update Google OAuth redirect URI**

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:

Add to **Authorized redirect URIs**:
```
https://your-app.vercel.app/api/auth/callback/google
```

- [ ] **Step 4: Trigger deployment**

Push any commit to `master` or click "Deploy" in Vercel dashboard.

Watch build logs. Expected: build succeeds, app live at `https://your-app.vercel.app`.

---

## Task 4 — Verify Production Deployment

- [ ] **Step 1: Check public routes**

Visit `https://your-app.vercel.app/church` — church homepage loads without login.
Visit `https://your-app.vercel.app/portal/invalid-token` — shows "invalid link" without login.

- [ ] **Step 2: Check auth redirect**

Visit `https://your-app.vercel.app/members` — redirects to `/login`. ✓
Visit `https://your-app.vercel.app/announcements` — redirects to `/login`. ✓
Visit `https://your-app.vercel.app/ministries` — redirects to `/login`. ✓

- [ ] **Step 3: Check staff login**

Log in with credentials. Verify all admin modules load:
- `/members` — member list
- `/announcements` — announcement list
- `/ministries` — ministry list grouped by network

- [ ] **Step 4: Create first admin user**

Run against Neon DB (via Neon SQL Editor):

```sql
INSERT INTO app.users (email, name, password_hash, role)
VALUES (
  'admin@jly.church',
  'Admin',
  -- bcrypt hash of your chosen password (generate with: node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)")
  '$2a$10$REPLACE_WITH_REAL_HASH',
  'admin'
);
```

Or use the existing seed if one exists in `db/migrations/R__seed_*.sql`.

---

## Task 5 — Seed Resend Domain Verification

> Required for email delivery to work in production.

- [ ] **Step 1: Add domain to Resend**

1. Go to https://resend.com/domains
2. Add your domain (e.g. `jly.church` or whatever domain is in `RESEND_FROM`)
3. Add the DNS records Resend provides (SPF, DKIM, DMARC)
4. Verify domain

- [ ] **Step 2: Update RESEND_FROM in Vercel**

Set `RESEND_FROM` to an address at your verified domain, e.g. `noreply@jly.church`.

Redeploy or the change takes effect on next deployment.

---

## Summary

| Task | Who | Blocker? |
|------|-----|----------|
| Fix middleware | Claude | **YES — security fix** |
| Provision Neon | Human | Yes (account needed) |
| Configure Vercel | Human | Yes (account needed) |
| Verify prod | Human | After deploy |
| Resend domain | Human | For email delivery |

**Task 1 (middleware fix) can and should be done immediately — it's a security bug regardless of deployment.**
