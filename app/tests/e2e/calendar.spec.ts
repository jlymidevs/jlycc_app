// app/tests/e2e/calendar.spec.ts
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

test.describe("Public church calendar", () => {
  test("renders current month with navigation", async ({ page }) => {
    await page.goto("/church/calendar");
    // Month heading like "June 2026"
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toContainText(/\b20\d{2}\b/);
    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  });

  test("prev/next navigation changes month", async ({ page }) => {
    await page.goto("/church/calendar?month=2026-06");
    await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Previous month" }).click();
    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(page.getByRole("heading", { name: "May 2026" })).toBeVisible();
  });

  test("grid/list toggle switches view", async ({ page }) => {
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    await expect(
      page.getByRole("button", { name: "List" })
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Grid" }).click();
    await expect(page.getByText("Sun", { exact: true })).toBeVisible();
  });
});

test.describe("Recurring series → calendar", () => {
  test("admin creates weekly series; occurrences appear on public calendar with add-to-calendar links", async ({
    page,
  }) => {
    await staffLogin(page);

    const seriesName = `E2E Weekly Service ${Date.now()}`;
    await page.goto("/events/series/new");
    await page.fill('input[name="name"]', seriesName);
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    // WEEKLY is default; pick Sunday
    await page.selectOption('select[name="dayOfWeek"]', "0");
    await page.fill('input[name="time"]', "09:00");
    await page.fill('input[name="durationMinutes"]', "120");
    await page.fill('input[name="venue"]', "Main Hall");
    // Start tomorrow (local date) so the first occurrence is in the future
    const tomorrow = new Date(Date.now() + 86_400_000);
    const startsOn = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await page.fill('input[name="startsOn"]', startsOn);
    await page.getByRole("button", { name: "Create series" }).click();

    await page.waitForURL("/events/series");
    await expect(page.getByText(seriesName)).toBeVisible();

    // Public calendar (list view) shows an occurrence within ~2 months
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    // Grid AND list are both in the DOM (toggle hides via CSS) — the list
    // copy comes last, so target .last() for the visible occurrence.
    let found = await page
      .getByText(seriesName)
      .last()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!found) {
      await page.getByRole("link", { name: "Next month" }).click();
      await page.getByRole("button", { name: "List" }).click();
      found = await page
        .getByText(seriesName)
        .last()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
    }
    expect(found).toBe(true);

    // Add-to-calendar links present on list rows
    await expect(
      page.getByRole("link", { name: "Add to Google Calendar" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download .ics" }).first()
    ).toBeVisible();
  });

  test("ics endpoint returns text/calendar", async ({ page, request }) => {
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    const icsLink = page.getByRole("link", { name: "Download .ics" }).first();
    if (!(await icsLink.isVisible().catch(() => false))) {
      test.skip(true, "no events this month");
    }
    const href = await icsLink.getAttribute("href");
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
  });

  test("admin cancels series; future occurrences leave the calendar", async ({
    page,
  }) => {
    await staffLogin(page);

    // Create a dedicated series to cancel
    const seriesName = `E2E Cancel Me ${Date.now()}`;
    await page.goto("/events/series/new");
    await page.fill('input[name="name"]', seriesName);
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    await page.selectOption('select[name="dayOfWeek"]', "3");
    await page.fill('input[name="time"]', "19:00");
    await page.fill('input[name="durationMinutes"]', "60");
    // Start tomorrow (local date) so every occurrence is in the future —
    // cancelSeries only cancels future occurrences; past ones stay on the calendar.
    const tomorrow = new Date(Date.now() + 86_400_000);
    const startsOn = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await page.fill('input[name="startsOn"]', startsOn);
    await page.getByRole("button", { name: "Create series" }).click();
    await page.waitForURL("/events/series");

    // Cancel it
    const row = page.locator("tr", { hasText: seriesName });
    await row.getByRole("link", { name: "Cancel series" }).click();
    await page.waitForURL(/\/events\/series\/\d+\/cancel/);
    await expect(
      page.getByRole("heading", { name: `Cancel series: ${seriesName}` })
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel series" }).click();
    await page.waitForURL("/events/series");
    await expect(
      page.locator("tr", { hasText: seriesName }).getByText("ENDED")
    ).toBeVisible();

    // Public calendar no longer lists it
    await page.goto("/church/calendar");
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.getByText(seriesName)).toHaveCount(0);
  });
});
