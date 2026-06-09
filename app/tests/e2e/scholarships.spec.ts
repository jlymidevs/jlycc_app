// app/tests/e2e/scholarships.spec.ts
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', STAFF_EMAIL);
  await page.fill('input[name="password"]', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/members");
}

test.describe("Scholarship programs", () => {
  test("Missions link visible in nav", async ({ page }) => {
    await staffLogin(page);
    await expect(page.getByRole("link", { name: "Missions" })).toBeVisible();
  });

  test("Scholarship programs page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await expect(page.getByRole("heading", { name: "Scholarship Programs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New program" })).toBeVisible();
  });

  test("New program page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships/new");
    await expect(page.getByRole("heading", { name: "New scholarship program" })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="status"]')).toBeVisible();
  });

  test("staff can create a scholarship program", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships/new");

    await page.fill('input[name="name"]', "E2E Test Scholarship 2026");
    await page.selectOption('select[name="status"]', "ACTIVE");
    await page.getByRole("button", { name: "Create program" }).click();

    await expect(page).toHaveURL(/\/missions\/scholarships\/\d+/);
    await expect(page.getByText("E2E Test Scholarship 2026").first()).toBeVisible();
  });

  test("created program appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await expect(page.getByText("E2E Test Scholarship 2026").first()).toBeVisible();
  });

  test("program detail shows Add award button", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await page.getByText("E2E Test Scholarship 2026").first().click();
    await expect(page.getByRole("link", { name: "Add award" })).toBeVisible();
  });

  test("Add award page loads with member ID field", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/missions/scholarships");
    await page.getByText("E2E Test Scholarship 2026").first().click();
    await page.getByRole("link", { name: "Add award" }).click();
    await expect(page.getByRole("heading", { name: "Add award" })).toBeVisible();
    await expect(page.locator('input[name="memberId"]')).toBeVisible();
  });
});
