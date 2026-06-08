// app/tests/e2e/attendance.spec.ts
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

test.describe("Attendance dashboard", () => {
  test("dashboard page loads", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events/attendance");
    await expect(
      page.getByRole("heading", { name: "Attendance Dashboard" })
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

    await page.getByRole("link", { name: "Attendance" }).click();
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
    await expect(
      page.getByText(/No person found for/)
    ).toBeVisible();
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

    // Search with a broad term — 'a' should match something in most seeds
    await page.goto(`/events/${eventId}/attendance?q=a`);
    // Either results or FTV prompt — both valid depending on DB state
    const hasResults = await page.locator('button:has-text("Check in")').count() > 0;
    const hasPrompt = await page.getByText(/No person found for/).count() > 0;
    expect(hasResults || hasPrompt).toBe(true);
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
    await expect(page.locator("svg")).toBeVisible();
  });
});
