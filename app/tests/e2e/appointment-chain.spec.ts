// app/tests/e2e/appointment-chain.spec.ts
// Phase 2: network-head appointment chain + ministry-head stage promotion.
import { test, expect } from "@playwright/test";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const LOCAL_DB = "postgresql://jly_admin:localdevpassword@localhost:5432/jly";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  waitFor: string | RegExp
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await page.waitForURL(waitFor, { timeout: 10000 });
  } catch {
    // Click can land before hydration and get swallowed — retry once.
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(waitFor);
  }
}

test.describe("Network-head appointment chain", () => {
  test("admin appoints network head; role flips; removal restores", async ({
    page,
  }) => {
    const stamp = Date.now();
    const email = `e2e-nethead-${stamp}@example.com`;
    const sql = postgres(LOCAL_DB, { max: 1 });
    const hash = bcrypt.hashSync("password123", 10);

    let memberId: number;
    let personId: number | null = null;
    let leaderId: number | null = null;

    try {
      const [p] = await sql`
        INSERT INTO core.person (first_name, last_name)
        VALUES ('Net', ${"Head" + stamp})
        RETURNING person_id
      `;
      personId = p.person_id;
      const [b] = await sql`
        SELECT branch_id FROM core.branch WHERE code = 'E2E-MAIN'
      `;
      const [m] = await sql`
        INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
        VALUES (${p.person_id}, ${b.branch_id}, ${"E2E-NH-" + stamp}, 'INNER_CORE', now())
        RETURNING member_id
      `;
      memberId = m.member_id;
      await sql`
        INSERT INTO app.users (email, name, password_hash, role, person_id)
        VALUES (${email}, ${"Net Head " + stamp}, ${hash}, 'MEMBER', ${p.person_id})
      `;
    } finally {
      await sql.end();
    }

    // Log in as SUPER_ADMIN → /members
    await login(page, "admin@jly.church", "changeme", "/members");
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    // Locate the E2E Network row in the Network Heads panel
    const networkRow = page.locator("tr", { hasText: "E2E Network" });
    await expect(networkRow).toBeVisible();

    // Ensure no active head for E2E Network — remove if one exists (cleanup from prior run)
    const removeBtn = networkRow.getByRole("button", { name: "Remove" });
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Select the newly created member from the candidates dropdown by value (memberId)
    const select = networkRow.locator('select[name="memberId"]');
    await expect(select).toBeVisible();
    await select.selectOption({ value: String(memberId!) });
    await networkRow
      .getByRole("button", { name: "Appoint" })
      .click();
    await page.waitForLoadState("networkidle");

    // Verify role in DB
    const sql2 = postgres(LOCAL_DB, { max: 1 });
    try {
      const [u] = await sql2`
        SELECT role FROM app.users WHERE email = ${email}
      `;
      expect(u.role).toBe("NETWORK_HEAD");

      // Capture the leaderId for cleanup
      const [nl] = await sql2`
        SELECT nl.leader_id
        FROM ministries.network_leader nl
        JOIN ministries.network n ON n.network_id = nl.network_id
        WHERE n.code = 'E2E-NET'
          AND nl.member_id = ${memberId!}
          AND nl.ended_at IS NULL
      `;
      if (nl) leaderId = nl.leader_id;
    } finally {
      await sql2.end();
    }

    // UI: Remove the appointment via the Remove button
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    const networkRowAfter = page.locator("tr", { hasText: "E2E Network" });
    const removeBtnAfter = networkRowAfter.getByRole("button", { name: "Remove" });
    await expect(removeBtnAfter).toBeVisible();
    await removeBtnAfter.click();
    await page.waitForLoadState("networkidle");

    // Verify role restored to MEMBER
    const sql3 = postgres(LOCAL_DB, { max: 1 });
    try {
      const [u] = await sql3`
        SELECT role FROM app.users WHERE email = ${email}
      `;
      expect(u.role).toBe("MEMBER");
    } finally {
      // Full cleanup — delete in FK-safe order: network_leader → user → member
      const sql4 = postgres(LOCAL_DB, { max: 1 });
      try {
        // Remove all network_leader rows for this member (ended or not)
        await sql4`
          DELETE FROM ministries.network_leader WHERE member_id = ${memberId!}
        `;
        await sql4`DELETE FROM app.users WHERE email = ${email}`;
        await sql4`DELETE FROM membership.member WHERE member_id = ${memberId!}`;
        if (personId) await sql4`DELETE FROM core.person WHERE person_id = ${personId}`;
      } finally {
        await sql4.end();
      }
      await sql3.end();
    }
  });
});

test.describe("Ministry-head stage promotion", () => {
  test("ministry head promotes a chapter member one step", async ({ page }) => {
    const stamp = Date.now();
    const sql = postgres(LOCAL_DB, { max: 1 });
    const hash = bcrypt.hashSync("password123", 10);

    const headEmail = `e2e-mhead-${stamp}@example.com`;
    let headMemberId: number;
    let promotableMemberId: number;
    let headPersonId: number | null = null;
    let promotablePersonId: number | null = null;

    try {
      const [b] = await sql`
        SELECT branch_id FROM core.branch WHERE code = 'E2E-MAIN'
      `;
      const [ch] = await sql`
        SELECT c.chapter_id
        FROM ministries.ministry_chapter c
        JOIN ministries.ministry mi ON mi.ministry_id = c.ministry_id
        WHERE mi.code = 'E2E-MIN'
        LIMIT 1
      `;

      // Ministry head account
      const [hp] = await sql`
        INSERT INTO core.person (first_name, last_name)
        VALUES ('Min', ${"Head" + stamp})
        RETURNING person_id
      `;
      const [hm] = await sql`
        INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
        VALUES (${hp.person_id}, ${b.branch_id}, ${"E2E-MH-" + stamp}, 'INNER_CORE', now())
        RETURNING member_id
      `;
      headMemberId = hm.member_id;
      headPersonId = hp.person_id;
      await sql`
        INSERT INTO app.users (email, name, password_hash, role, person_id)
        VALUES (${headEmail}, ${"Min Head " + stamp}, ${hash}, 'MINISTRY_HEAD', ${hp.person_id})
      `;
      await sql`
        INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at, is_leader, leader_role)
        VALUES (${ch.chapter_id}, ${hm.member_id}, now(), true, 'HEAD')
      `;

      // Promotable member (REGULAR_MEMBER)
      const [mp] = await sql`
        INSERT INTO core.person (first_name, last_name)
        VALUES ('Promo', ${"Tee" + stamp})
        RETURNING person_id
      `;
      const [mm] = await sql`
        INSERT INTO membership.member (person_id, branch_id, member_code, current_stage, joined_at)
        VALUES (${mp.person_id}, ${b.branch_id}, ${"E2E-PR-" + stamp}, 'REGULAR_MEMBER', now())
        RETURNING member_id
      `;
      promotableMemberId = mm.member_id;
      promotablePersonId = mp.person_id;
      await sql`
        INSERT INTO ministries.ministry_membership (chapter_id, member_id, joined_at)
        VALUES (${ch.chapter_id}, ${mm.member_id}, now())
      `;
    } finally {
      await sql.end();
    }

    // Log in as ministry head → /ministry
    await login(page, headEmail, "password123", "**/ministry**");
    await expect(
      page.getByRole("heading", { name: "My ministry" })
    ).toBeVisible();

    // Find the promotable member row and click Promote
    const memberName = `Promo Tee${stamp}`;
    const row = page.locator("tr", { hasText: memberName });
    await expect(row).toBeVisible();
    const promoteBtn = row.getByRole("button", { name: /Promote/i });
    await expect(promoteBtn).toBeVisible();
    await promoteBtn.click();
    await page.waitForLoadState("networkidle");

    // Verify DB: current_stage updated + history row written
    const sql2 = postgres(LOCAL_DB, { max: 1 });
    try {
      const [after] = await sql2`
        SELECT current_stage FROM membership.member WHERE member_id = ${promotableMemberId!}
      `;
      expect(after.current_stage).toBe("JOSHUA_GENERATION");

      const [hist] = await sql2`
        SELECT to_stage, changed_by_person_id
        FROM membership.lifecycle_stage_history
        WHERE member_id = ${promotableMemberId!}
        ORDER BY changed_at DESC
        LIMIT 1
      `;
      expect(hist.to_stage).toBe("JOSHUA_GENERATION");
    } finally {
      // Full cleanup
      const sql3 = postgres(LOCAL_DB, { max: 1 });
      try {
        await sql3`
          DELETE FROM ministries.ministry_membership
          WHERE member_id IN (${headMemberId!}, ${promotableMemberId!})
        `;
        await sql3`DELETE FROM app.users WHERE email = ${headEmail}`;
        await sql3`
          DELETE FROM membership.lifecycle_stage_history
          WHERE member_id IN (${headMemberId!}, ${promotableMemberId!})
        `;
        await sql3`
          DELETE FROM membership.member
          WHERE member_id IN (${headMemberId!}, ${promotableMemberId!})
        `;
        if (headPersonId) {
          await sql3`DELETE FROM core.person WHERE person_id = ${headPersonId}`;
        }
        if (promotablePersonId) {
          await sql3`DELETE FROM core.person WHERE person_id = ${promotablePersonId}`;
        }
      } finally {
        await sql3.end();
      }
      await sql2.end();
    }
  });
});
