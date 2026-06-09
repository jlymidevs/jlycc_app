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

test.describe("Ministries module", () => {
  test("ministry list loads with network sections", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");
    await expect(page).toHaveURL("/ministries");
    // page should load (not 404/500)
    await expect(page.locator("h1")).toBeVisible();
  });

  test("clicking ministry navigates to detail page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistryLink = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistryLink.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistryLink.click();
    await expect(page).toHaveURL(/\/ministries\/\d+/);
    // should have chapters section
    await expect(page.getByRole("heading", { name: "Chapters", exact: true })).toBeVisible();
  });

  test("ministry detail page has chapters section", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistryLink = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistryLink.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistryLink.click();
    await expect(page).toHaveURL(/\/ministries\/\d+/);
    // chapters section heading
    await expect(page.getByRole("heading", { name: "Chapters", exact: true })).toBeVisible();
  });

  test("chapter detail page loads when chapter exists", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistryLink = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistryLink.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistryLink.click();
    await expect(page).toHaveURL(/\/ministries\/\d+/);

    const chapterLink = page.locator("a[href*='/chapters/']").first();
    if (await chapterLink.count() === 0) {
      test.skip();
      return;
    }

    await chapterLink.click();
    await expect(page).toHaveURL(/\/ministries\/\d+\/chapters\/\d+/);
    await expect(page.getByText(/active members/i)).toBeVisible();
  });

  test("add member search form is visible on chapter page", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/ministries");

    const firstMinistryLink = page.locator("a[href^='/ministries/']").first();
    if (await firstMinistryLink.count() === 0) {
      test.skip();
      return;
    }

    await firstMinistryLink.click();
    const chapterLink = page.locator("a[href*='/chapters/']").first();
    if (await chapterLink.count() === 0) {
      test.skip();
      return;
    }

    await chapterLink.click();
    await expect(page).toHaveURL(/\/ministries\/\d+\/chapters\/\d+/);
    await expect(page.getByText(/add member/i)).toBeVisible();
    await expect(page.locator('input[name="q"]')).toBeVisible();
  });
});
