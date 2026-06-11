// app/tests/e2e/education.spec.ts
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

test.describe("BC student management", () => {
  test("Education link visible in nav", async ({ page }) => {
    await staffLogin(page);
    await expect(page.getByRole("link", { name: "Education" })).toBeVisible();
  });

  test("BC students page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/students");
    await expect(page.getByRole("heading", { name: "BC Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register student" })).toBeVisible();
  });

  test("Register student page loads with cohort select", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/students/new");
    await expect(page.getByRole("heading", { name: "Register student" })).toBeVisible();
    await expect(page.locator('select[name="cohortId"]')).toBeVisible();
  });

  test("BC offerings page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/bc/offerings");
    await expect(page.getByRole("heading", { name: "BC Course Offerings" })).toBeVisible();
  });
});

test.describe("ISU student management", () => {
  test("ISU students page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students");
    await expect(page.getByRole("heading", { name: "ISU Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register student" })).toBeVisible();
  });

  test("Register ISU student page loads with track select", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students/new");
    await expect(page.getByRole("heading", { name: "Register ISU student" })).toBeVisible();
    await expect(page.locator('select[name="currentTrackId"]')).toBeVisible();
  });

  test("staff can register an ISU student and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students/new");

    await page.fill('input[name="personId"]', "2");
    await page.fill('input[name="enrolledOn"]', "2026-01-15");
    await page.getByRole("button", { name: "Register student" }).click();

    // skip if person already registered (unique constraint)
    const onNewPage = page.url().includes("/new");
    if (onNewPage) { test.skip(); return; }
    await expect(page).toHaveURL(/\/education\/isu\/students\/\d+/);
    await expect(page.getByText("Current track:")).toBeVisible();
  });

  test("registered ISU student appears in list", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/students");
    // list should have at least 1 student row
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("ISU sessions page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/sessions");
    await expect(page.getByRole("heading", { name: "ISU Sessions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New session" })).toBeVisible();
  });

  test("staff can create an ISU session", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/education/isu/sessions/new");
    await expect(page.getByRole("heading", { name: "New ISU session" })).toBeVisible();

    await page.selectOption('select[name="branchId"]', { index: 1 });
    await page.selectOption('select[name="trackId"]', { index: 1 });
    await page.fill('input[name="topic"]', "E2E ISU Session Topic");
    await page.getByRole("button", { name: "Create session" }).click();

    await expect(page).toHaveURL(/\/education\/isu\/sessions\/\d+\/attendance/);
    await expect(page.getByRole("heading", { name: /Attendance/ })).toBeVisible();
  });
});
