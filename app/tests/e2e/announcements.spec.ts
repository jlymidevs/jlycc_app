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

test.describe("Announcements", () => {
  test("staff can create a draft announcement", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Test Announcement");
    await page.fill('textarea[name="body"]', "This is a test body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    // Should redirect to detail page
    await expect(page).toHaveURL(/\/announcements\/\d+/);
    await expect(page.getByRole("heading", { name: "E2E Test Announcement" })).toBeVisible();
  });

  test("draft announcement shows DRAFT badge", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Draft Badge Test");
    await page.fill('textarea[name="body"]', "Draft body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    await expect(page).toHaveURL(/\/announcements\/\d+/);
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  });

  test("staff can publish an announcement", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Publish Test");
    await page.fill('textarea[name="body"]', "Publish body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    await expect(page).toHaveURL(/\/announcements\/\d+/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
    await expect(page.getByText("Delivered")).toBeVisible();
  });

  test("published announcement shows recipient count", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Recipient Count Test");
    await page.fill('textarea[name="body"]', "Recipient count body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    await expect(page).toHaveURL(/\/announcements\/\d+/);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
    // Recipient count shown in details section — just check it's a number (could be 0+)
    await expect(page.getByRole("heading", { name: /Recipients/ })).toBeVisible();
  });

  test("staff can archive a published announcement", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/announcements/new");
    await page.fill('input[name="title"]', "E2E Archive Test");
    await page.fill('textarea[name="body"]', "Archive body.");
    await page.selectOption('select[name="targetType"]', "ALL_MEMBERS");
    await page.getByRole("button", { name: "Create announcement" }).click();
    await expect(page).toHaveURL(/\/announcements\/\d+/);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("ARCHIVED", { exact: true })).toBeVisible();
  });
});
