// app/tests/e2e/roles-journey.spec.ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@jly.church";
const ADMIN_PASSWORD = "changeme";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  waitFor: string | RegExp
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(waitFor);
}

test.describe("Signup and member profile", () => {
  test("new signup lands on /me with journey ladder", async ({ page }) => {
    const email = `e2e-member-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Member");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    // Head picker present only when a head exists; pick first option if shown.
    const picker = page.locator('select[name="chapterId"]');
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/login/);

    await login(page, email, "password123", "/me");
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    await expect(page.getByText("Regular Member").first()).toBeVisible();
  });

  test("MEMBER is blocked from admin routes", async ({ page }) => {
    const email = `e2e-blocked-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Blocked");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    const picker = page.locator('select[name="chapterId"]');
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/login/);
    await login(page, email, "password123", "/me");

    await page.goto("/members");
    await page.waitForURL("/me");
  });
});

test.describe("Welcome profile completion", () => {
  test("member without ministry completes profile on /welcome and lands on /me", async ({
    page,
  }) => {
    const email = `e2e-welcome-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Welcome");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    const picker = page.locator('select[name="chapterId"]');
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL(/\/login/);
    await login(page, email, "password123", "/me");

    await page.goto("/welcome");
    // If the signup filed a join request (head existed), /welcome bounces to /me.
    if (page.url().endsWith("/me")) return;

    await expect(
      page.getByRole("heading", { name: "Welcome to JLY Church!" })
    ).toBeVisible();
    await page.fill('input[name="mobile"]', "+63 917 000 1122");
    await page.fill('input[name="dateOfBirth"]', "1990-01-15");
    await page.selectOption('select[name="gender"]', "FEMALE");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL("/me");
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
  });

  test("/welcome requires login", async ({ page }) => {
    await page.goto("/welcome");
    await page.waitForURL(/\/login/);
  });
});

test.describe("Super admin user management", () => {
  test("admin (SUPER_ADMIN seed) can open /users and see roles", async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/members");
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test("admin sees own member profile at /me", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/members");
    await page.goto("/me");
    // Either the journey ladder (profile provisioned) or the not-linked notice.
    const journey = page.getByRole("heading", { name: "Journey" });
    const notLinked = page.getByText("not linked");
    await expect(journey.or(notLinked)).toBeVisible();
  });
});
