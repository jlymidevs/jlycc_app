// app/tests/e2e/members.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

test.describe("Member management", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', STAFF_EMAIL);
    await page.fill('input[name="password"]', STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    try {
      await page.waitForURL("/members", { timeout: 10000 });
    } catch {
      // Click can land before hydration and get swallowed - retry once.
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("/members");
    }
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Use a fresh context without session
    await page.context().clearCookies();
    await page.goto("/members");
    await expect(page).toHaveURL("/login");
  });

  test("staff can view member list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await expect(page.getByPlaceholder("Search by name…")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add member" })).toBeVisible();
  });

  test("staff can search members by name", async ({ page }) => {
    await page.fill('input[name="q"]', "Santos");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=Santos/);
  });

  test("staff can navigate to create member page", async ({ page }) => {
    await page.click('a:has-text("Add member")');
    await expect(page).toHaveURL("/members/new");
    await expect(
      page.getByRole("heading", { name: "Add member" })
    ).toBeVisible();
  });

  test("create form validates required fields", async ({ page }) => {
    await page.goto("/members/new");
    await page.getByRole("button", { name: "Create member" }).click();
    // HTML5 required validation fires — form does not submit
    await expect(page).toHaveURL("/members/new");
  });
});
