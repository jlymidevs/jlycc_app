// app/tests/e2e/profile.spec.ts
// Phase 1: one-time welcome gate + /me/profile round-trip.
import { test, expect } from "@playwright/test";
import postgres from "postgres";

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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(waitFor);
  }
}

async function signupMember(
  page: import("@playwright/test").Page,
  prefix: string,
  firstName: string,
  lastName: string
) {
  const email = `${prefix}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  const picker = page.locator('select[name="chapterId"]');
  if (await picker.isVisible().catch(() => false)) {
    await picker.selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/login/);
  return email;
}

async function markProfileCompleted(email: string) {
  const sql = postgres(LOCAL_DB, { max: 1 });
  try {
    await sql`
      update app.users set profile_completed_at = now() where email = ${email}
    `;
    // Signup also files a ministry join request when a chapter was picked, and
    // /welcome bounces to /me for EITHER the flag or an existing request.
    // Delete the request so the flag is the only bounce path under test.
    await sql`
      delete from ministries.join_request jr
      using membership.member m, app.users u
      where jr.member_id = m.member_id
        and m.person_id = u.person_id
        and u.email = ${email}
    `;
  } finally {
    await sql.end();
  }
}

test.describe("One-time welcome + my profile", () => {
  test("welcome shows once: flag set -> /welcome bounces to /me", async ({
    page,
  }) => {
    const email = await signupMember(page, "e2e-profile", "Profile", "Tester");

    // Simulate a completed welcome step directly in the DB.
    await markProfileCompleted(email);

    await login(page, email, "password123", "/me");
    await page.goto("/welcome");
    await page.waitForURL(/\/me/);
    await expect(page).not.toHaveURL(/welcome/);
  });

  test("my profile: edit province round-trip + stage chip visible", async ({
    page,
  }) => {
    const email = await signupMember(page, "e2e-profile2", "Prov", "Round");
    await markProfileCompleted(email);

    await login(page, email, "password123", "/me");
    // New credentials signups are provisioned at REGULAR_MEMBER.
    await expect(page.getByText("Regular Member").first()).toBeVisible();

    await page.goto("/me/profile");
    await expect(
      page.getByRole("heading", { name: "My Profile" })
    ).toBeVisible();
    // Membership-stage chip renders on the profile page itself.
    await expect(page.getByText("Regular Member")).toBeVisible();
    // Fresh members have no address row; page defaults country to PH, so the
    // province select renders.
    await page.selectOption('select[name="province"]', "Cavite");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.waitForURL("**/me/profile?saved=1**");
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.goto("/me/profile");
    await expect(page.locator('select[name="province"]')).toHaveValue("Cavite");
  });
});
