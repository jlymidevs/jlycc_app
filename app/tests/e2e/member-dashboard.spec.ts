// app/tests/e2e/member-dashboard.spec.ts
import { test, expect } from "@playwright/test";

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

async function signupMember(page: import("@playwright/test").Page) {
  const email = `e2e-shell-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"]', "Shell");
  await page.fill('input[name="lastName"]', "Member");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  const picker = page.locator('select[name="chapterId"]');
  if (await picker.isVisible().catch(() => false)) {
    await picker.selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/login/);
  await login(page, email, "password123", "/me");
  return email;
}

test.describe("Member dashboard shell", () => {
  test("member sees member nav, no admin link", async ({ page }) => {
    await signupMember(page);
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Attendance", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Ministries", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Announcements", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Portal", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ministry Dashboard", exact: true })).toHaveCount(0);
  });

  test("member navigates between dashboard pages", async ({ page }) => {
    await signupMember(page);
    await page.getByRole("link", { name: "My Attendance", exact: true }).click();
    await page.waitForURL("/me/attendance");
    await expect(page.getByRole("heading", { name: "My attendance" })).toBeVisible();

    await page.getByRole("link", { name: "My Ministries", exact: true }).click();
    await page.waitForURL("/me/ministries");
    await expect(page.getByRole("heading", { name: "My ministries" })).toBeVisible();

    await page.getByRole("link", { name: "Announcements", exact: true }).click();
    await page.waitForURL("/me/announcements");
    await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  });

  test("overview keeps journey ladder", async ({ page }) => {
    await signupMember(page);
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    await expect(page.getByText("Regular Member").first()).toBeVisible();
  });

  test("admin still sees admin portal sidebar", async ({ page }) => {
    await login(page, "admin@jly.church", "changeme", "/members");
    await expect(page.getByRole("link", { name: "Members", exact: true })).toBeVisible();
    await expect(page.getByText("Admin Portal")).toBeVisible();
  });

  test("super admin reaches /users from sidebar, page renders in shell", async ({ page }) => {
    await login(page, "admin@jly.church", "changeme", "/members");
    await expect(page.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.waitForURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    // Shell chrome present: sidebar still shows admin items.
    await expect(page.getByRole("link", { name: "Members", exact: true })).toBeVisible();
  });
});
