// app/tests/e2e/membership-extensions.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

async function staffLogin(page: import("@playwright/test").Page) {
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
}

test.describe("Membership Extensions", () => {
  test("Applications queue page loads at /members/applications", async ({
    page,
  }) => {
    await staffLogin(page);
    await page.goto("/members/applications");
    await expect(
      page.getByRole("heading", { name: "Pending Applications" })
    ).toBeVisible();
  });

  test("Member detail page has Roles section", async ({ page }) => {
    await staffLogin(page);
    // Navigate to the first member by going to members list and clicking first link
    await page.goto("/members");
    // Click the first member in the list
    const firstMemberLink = page.locator("a").filter({ hasText: /\w+, \w+/ }).first();
    await firstMemberLink.click();
    // Verify we're on a member detail page
    await expect(page).toHaveURL(/\/members\/\d+$/);
    // Check that Roles section is visible
    await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
  });

  test("Member detail page has Pastoral Care section", async ({ page }) => {
    await staffLogin(page);
    // Navigate to the first member by going to members list and clicking first link
    await page.goto("/members");
    // Click the first member in the list
    const firstMemberLink = page.locator("a").filter({ hasText: /\w+, \w+/ }).first();
    await firstMemberLink.click();
    // Verify we're on a member detail page
    await expect(page).toHaveURL(/\/members\/\d+$/);
    // Check that Pastoral Care section is visible
    await expect(
      page.getByRole("heading", { name: "Pastoral Care" })
    ).toBeVisible();
  });

  test("Member detail page has Regular Member Application section", async ({
    page,
  }) => {
    await staffLogin(page);
    // Navigate to the first member by going to members list and clicking first link
    await page.goto("/members");
    // Click the first member in the list
    const firstMemberLink = page.locator("a").filter({ hasText: /\w+, \w+/ }).first();
    await firstMemberLink.click();
    // Verify we're on a member detail page
    await expect(page).toHaveURL(/\/members\/\d+$/);
    // Check that Regular Member Application section is visible
    await expect(
      page.getByRole("heading", { name: "Regular Member Application" })
    ).toBeVisible();
  });

  test("Assign role form visible on member detail", async ({ page }) => {
    await staffLogin(page);
    // Navigate to the first member by going to members list and clicking first link
    await page.goto("/members");
    // Click the first member in the list
    const firstMemberLink = page.locator("a").filter({ hasText: /\w+, \w+/ }).first();
    await firstMemberLink.click();
    // Verify we're on a member detail page
    await expect(page).toHaveURL(/\/members\/\d+$/);
    // Check for role assignment form elements
    await expect(page.locator('select[name="roleId"]')).toBeVisible();
    await expect(page.locator("#roleAssignedAt")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Assign" }).first()
    ).toBeVisible();
  });

  test("Submit application button visible on member detail (if no existing application)", async ({
    page,
  }) => {
    await staffLogin(page);
    // Navigate to the first member by going to members list and clicking first link
    await page.goto("/members");
    // Click the first member in the list
    const firstMemberLink = page.locator("a").filter({ hasText: /\w+, \w+/ }).first();
    await firstMemberLink.click();
    // Verify we're on a member detail page
    await expect(page).toHaveURL(/\/members\/\d+$/);
    // Check for submit application button (only visible if no existing application)
    // The button may not be visible if an application already exists, so we check
    // that the Regular Member Application section exists and contains either
    // a status badge or the submit button
    const appSection = page.locator(
      "section:has(h2:has-text('Regular Member Application'))"
    );
    await expect(appSection).toBeVisible();
    // Check if submit button is visible or if a status badge is showing
    const submitButton = appSection.getByRole("button", {
      name: "Submit application",
    });
    const statusBadge = appSection.locator(
      "[class*='rounded-full'][class*='bg-']"
    );
    const elementVisible =
      (await submitButton.isVisible().catch(() => false)) ||
      (await statusBadge.isVisible().catch(() => false));
    expect(elementVisible).toBeTruthy();
  });
});
