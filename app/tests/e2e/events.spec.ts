// app/tests/e2e/events.spec.ts
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

test.describe("Staff event management", () => {
  test("staff can create an event and land on detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events/new");
    await expect(page.getByRole("heading", { name: "Add event" })).toBeVisible();

    await page.fill('input[name="name"]', "E2E Test Service");
    // Select first available event type
    await page.selectOption('select[name="eventTypeId"]', { index: 1 });
    await page.fill('input[name="startsAt"]', "2026-12-25T10:00");
    await page.fill('input[name="venue"]', "Main Hall");
    await page.getByRole("button", { name: "Create event" }).click();

    // Should redirect to event detail
    await expect(page).toHaveURL(/\/events\/\d+/);
    await expect(
      page.getByRole("heading", { name: "E2E Test Service" })
    ).toBeVisible();
  });

  test("staff can edit an event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");
    // Click first event in list
    const firstLink = page.locator("table tbody tr:first-child a").first();
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/events\/\d+\/edit/);

    await page.fill('input[name="name"]', "E2E Updated Event Name");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(/\/events\/\d+/);
    await expect(
      page.getByRole("heading", { name: "E2E Updated Event Name" })
    ).toBeVisible();
  });

  test("staff can cancel an event", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");
    const firstLink = page.locator("table tbody tr:first-child a").first();
    await firstLink.click();
    await page.waitForURL(/\/events\/\d+/);

    const cancelButton = page.getByRole("button", { name: "Cancel event" });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.getByText("CANCELLED")).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("staff can see registrant after public registration", async ({
    page,
    context,
  }) => {
    await staffLogin(page);
    await page.goto("/events");

    // Find a SCHEDULED event link
    const eventLink = page
      .locator("table tbody tr")
      .filter({ has: page.locator("td span:has-text('SCHEDULED')") })
      .first()
      .locator("a")
      .first();

    const href = await eventLink.getAttribute("href");
    if (!href) {
      test.skip();
      return;
    }
    const eventId = href.split("/").pop();

    // Register via public form in new tab
    const publicPage = await context.newPage();
    await publicPage.goto(`/church/events/${eventId}`);
    await publicPage.fill('input[name="name"]', "E2E Registrant");
    await publicPage.fill('input[name="email"]', `e2e-${Date.now()}@test.com`);
    await publicPage.getByRole("button", { name: "Register" }).click();
    await expect(publicPage.getByText("You're registered!")).toBeVisible();
    await publicPage.close();

    // Refresh staff detail page
    await page.goto(`/events/${eventId}`);
    await expect(page.getByText("E2E Registrant")).toBeVisible();
  });

  test("staff can confirm a registrant", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/events");

    const eventLink = page
      .locator("table tbody tr")
      .filter({ has: page.locator("td span:has-text('SCHEDULED')") })
      .first()
      .locator("a")
      .first();

    const href = await eventLink.getAttribute("href");
    if (!href) {
      test.skip();
      return;
    }

    await page.goto(href);
    const confirmButton = page
      .locator("table tbody tr")
      .filter({ has: page.locator("td span:has-text('REGISTERED')") })
      .first()
      .getByRole("button", { name: "Confirm" });

    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await expect(page.getByText("CONFIRMED")).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe("Public event registration", () => {
  test("public user can register for an event", async ({ page }) => {
    await page.goto("/church/events");
    const registerLink = page.getByRole("link", { name: "Register" }).first();

    if (!(await registerLink.isVisible())) {
      test.skip();
      return;
    }

    await registerLink.click();
    await page.fill('input[name="name"]', "Public Test User");
    await page.fill(
      'input[name="email"]',
      `public-${Date.now()}@test.com`
    );
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("You're registered!")).toBeVisible();
  });

  test("duplicate registration shows friendly message", async ({ page }) => {
    await page.goto("/church/events");
    const registerLink = page.getByRole("link", { name: "Register" }).first();
    if (!(await registerLink.isVisible())) {
      test.skip();
      return;
    }

    const href = await registerLink.getAttribute("href");
    if (!href) {
      test.skip();
      return;
    }

    const sharedEmail = `dup-${Date.now()}@test.com`;

    // First registration
    await page.goto(href);
    await page.fill('input[name="name"]', "Dup Test User");
    await page.fill('input[name="email"]', sharedEmail);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("You're registered!")).toBeVisible();

    // Second registration with same email
    await page.goto(href);
    await page.fill('input[name="name"]', "Dup Test User");
    await page.fill('input[name="email"]', sharedEmail);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(
      page.getByText("You're already registered for this event.")
    ).toBeVisible();
  });
});
