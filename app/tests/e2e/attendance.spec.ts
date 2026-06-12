// app/tests/e2e/attendance.spec.ts
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

test.describe("Attendance dashboard", () => {
  test("dashboard page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events/attendance");
    await expect(
      page.getByRole("heading", { name: "Attendance" })
    ).toBeVisible();
    await expect(page.locator('select[name="branchId"]')).toBeVisible();
    await expect(page.locator('select[name="range"]')).toBeVisible();
  });
});

test.describe("Per-event attendance", () => {
  test("attendance page loads for first event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) {
      test.skip();
      return;
    }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    await page.getByRole("main").getByRole("link", { name: "Attendance" }).click();
    await page.waitForURL(/\/events\/\d+\/attendance/);

    await expect(
      page.getByRole("heading", { name: "Attendance" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search by name or email…")).toBeVisible();
  });

  test("search with no results shows FTV prompt", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) {
      test.skip();
      return;
    }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);
    const url = page.url();
    const eventId = url.match(/\/events\/(\d+)/)?.[1];
    if (!eventId) { test.skip(); return; }

    await page.goto(`/events/${eventId}/attendance?q=ZZZNobodyHasThisName999`);
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
  });

  test("search with query shows results or FTV prompt depending on DB", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) { test.skip(); return; }
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);
    const eventId = page.url().match(/\/events\/(\d+)/)?.[1];
    if (!eventId) { test.skip(); return; }

    // Search with a broad term — page should load without error
    await page.goto(`/events/${eventId}/attendance?q=a`);
    await expect(page.getByRole("heading", { name: /Attendance/ })).toBeVisible();
  });
});

test.describe("Member QR code", () => {
  test("member detail page shows QR code section", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/members");

    const firstLink = page.locator("table tbody tr:first-child a").first();
    if ((await firstLink.count()) === 0) { test.skip(); return; }
    await firstLink.click();
    await page.waitForURL(/\/members\/\d+/);

    await expect(page.getByText("Attendance QR")).toBeVisible();
    // Scope to the QR section — the sidebar nav also renders SVG icons.
    await expect(
      page.locator("section, div").filter({ hasText: "Attendance QR" }).locator("svg").last()
    ).toBeVisible();
  });
});
