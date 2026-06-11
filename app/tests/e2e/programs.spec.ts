// app/tests/e2e/programs.spec.ts
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

test.describe("Heartlink cohort management", () => {
  test("staff can create a cohort and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink/new");
    await expect(page.getByRole("heading", { name: "New cohort" })).toBeVisible();

    await page.fill('input[name="name"]', "E2E Heartlink Cohort");
    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.getByRole("button", { name: "Create cohort" }).click();

    await expect(page).toHaveURL(/\/programs\/heartlink\/\d+/);
    await expect(page.getByRole("heading", { name: "E2E Heartlink Cohort" })).toBeVisible();
  });

  test("created cohort appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink");
    await expect(page.getByText("E2E Heartlink Cohort").first()).toBeVisible();
  });

  test("staff can add a session to a cohort", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink");

    await page.getByText("E2E Heartlink Cohort").first().click();
    await page.waitForURL(/\/programs\/heartlink\/\d+/);

    await page.getByRole("link", { name: "Add session" }).click();
    await page.waitForURL(/\/programs\/heartlink\/\d+\/sessions\/new/);

    await page.fill('input[name="sessionNumber"]', "1");
    await page.fill('input[name="topic"]', "Introduction");
    await page.getByRole("button", { name: "Add session" }).click();

    // redirects to attendance page
    await expect(page).toHaveURL(/\/programs\/heartlink\/\d+\/sessions\/\d+\/attendance/);
    await expect(page.getByText("Session 1 Attendance")).toBeVisible();
  });

  test("staff can enroll a person and verify enrollee count increases", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink");

    await page.getByText("E2E Heartlink Cohort").first().click();
    await page.waitForURL(/\/programs\/heartlink\/\d+/);

    await page.getByRole("link", { name: "Enroll person" }).click();
    await page.waitForURL(/\/programs\/heartlink\/\d+\/enroll/);

    // Use person ID 1 (seed data person)
    await page.fill('input[name="personId"]', "1");
    await page.getByRole("button", { name: "Enroll" }).click();

    await page.waitForURL(/\/programs\/heartlink\/\d+/);
    // enrollee count should now be >= 1
    const countText = await page.locator("p.text-xs", { hasText: "Enrollees" })
      .locator("..")
      .locator("p.text-2xl")
      .textContent();
    expect(Number(countText)).toBeGreaterThan(0);
  });

  test("staff can mark attendance via checklist", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink");

    await page.getByText("E2E Heartlink Cohort").first().click();
    await page.waitForURL(/\/programs\/heartlink\/\d+/);

    // go to first session attendance
    await page.getByText("Session 1").click();
    await page.waitForURL(/\/programs\/heartlink\/\d+\/sessions\/\d+\/attendance/);

    // mark present for first row (first ✓ button in the table)
    const presentBtn = page.locator("table tbody tr:first-child td:nth-child(2) button");
    await presentBtn.click();
    // page should reload (server action + revalidate)
    await page.waitForTimeout(500);
    // button should now be highlighted green (bg-green-100)
    await expect(presentBtn).toHaveClass(/bg-green-100/);
  });

  test("QR scanner section is visible on attendance page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/heartlink");
    await page.getByText("E2E Heartlink Cohort").first().click();
    await page.waitForURL(/\/programs\/heartlink\/\d+/);
    await page.getByText("Session 1").click();
    await page.waitForURL(/\/programs\/heartlink\/\d+\/sessions\/\d+\/attendance/);
    await expect(page.getByRole("heading", { name: "QR Check-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start QR scanner" })).toBeVisible();
  });
});

test.describe("BAC initiative management", () => {
  test("staff can create an initiative and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac/new");
    await expect(page.getByRole("heading", { name: "New initiative" })).toBeVisible();

    await page.fill('input[name="name"]', "E2E BAC Initiative");
    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.getByRole("button", { name: "Create initiative" }).click();

    await expect(page).toHaveURL(/\/programs\/bac\/\d+/);
    await expect(page.getByRole("heading", { name: "E2E BAC Initiative" })).toBeVisible();
  });

  test("created initiative appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac");
    await expect(page.getByText("E2E BAC Initiative").first()).toBeVisible();
  });

  test("staff can add a BAC session", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac");
    await page.getByText("E2E BAC Initiative").last().click();
    await page.waitForURL(/\/programs\/bac\/\d+/);

    // skip if session 1 already exists (accumulated test data)
    if (await page.getByText("Session 1").count() > 0) { test.skip(); return; }

    await page.getByRole("link", { name: "Add session" }).click();
    await page.waitForURL(/\/programs\/bac\/\d+\/sessions\/new/);

    await page.fill('input[name="sessionNumber"]', "1");
    await page.fill('input[name="topic"]', "Community Outreach");
    await page.getByRole("button", { name: "Create session" }).click();

    await expect(page).toHaveURL(/\/programs\/bac\/\d+\/sessions\/\d+\/attendance/);
    await expect(page.getByText("Session 1 Attendance")).toBeVisible();
  });

  test("staff can add a participant", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac");
    await page.getByText("E2E BAC Initiative").last().click();
    await page.waitForURL(/\/programs\/bac\/\d+/);

    await page.getByRole("link", { name: "Add participant" }).click();
    await page.waitForURL(/\/programs\/bac\/\d+\/participants/);

    await page.fill('input[name="personId"]', "1");
    await page.getByRole("button", { name: "Add participant" }).click();

    await page.waitForURL(/\/programs\/bac\/\d+/);
    // participant count should be >= 1
    const countText = await page.locator("p.text-xs", { hasText: "Participants" })
      .locator("..")
      .locator("p.text-2xl")
      .textContent();
    expect(Number(countText)).toBeGreaterThan(0);
  });

  test("staff can mark BAC attendance via checklist", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac");
    await page.getByText("E2E BAC Initiative").last().click();
    await page.waitForURL(/\/programs\/bac\/\d+/);

    if (await page.getByText("Session 1").count() === 0) { test.skip(); return; }
    await page.getByText("Session 1").first().click();
    await page.waitForURL(/\/programs\/bac\/\d+\/sessions\/\d+\/attendance/);

    // mark present for first row (first ✓ button in the table)
    const presentBtn = page.locator("table tbody tr:first-child td:nth-child(2) button");
    await presentBtn.click();
    await page.waitForTimeout(500);
    await expect(presentBtn).toHaveClass(/bg-green-100/);
  });

  test("QR scanner section visible on BAC attendance page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/programs/bac");
    await page.getByText("E2E BAC Initiative").last().click();
    await page.waitForURL(/\/programs\/bac\/\d+/);
    if (await page.getByText("Session 1").count() === 0) { test.skip(); return; }
    await page.getByText("Session 1").first().click();
    await page.waitForURL(/\/programs\/bac\/\d+\/sessions\/\d+\/attendance/);
    await expect(page.getByRole("heading", { name: "QR Check-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start QR scanner" })).toBeVisible();
  });
});
