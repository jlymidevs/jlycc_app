import { test, expect } from "@playwright/test";

test.describe("Public church homepage", () => {
  test("homepage loads with JLY Church heading", async ({ page }) => {
    await page.goto("/church");
    await expect(
      page.getByRole("heading", { name: "JLY Church", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Love God. Love People. Change the World.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See all events" })).toBeVisible();
  });

  test("nav shows JLY Church and Events links", async ({ page }) => {
    await page.goto("/church");
    await expect(page.getByRole("link", { name: "JLY Church" })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Events", exact: true })).toBeVisible();
  });

  test("Events nav link navigates to /church/events", async ({ page }) => {
    await page.goto("/church");
    await page.getByRole("navigation").getByRole("link", { name: "Events", exact: true }).click();
    await expect(page).toHaveURL("/church/events");
    await expect(
      page.getByRole("heading", { name: "Upcoming Events" })
    ).toBeVisible();
  });

  test("upcoming events section visible (with or without events)", async ({ page }) => {
    await page.goto("/church");
    await expect(
      page.getByRole("heading", { name: "Upcoming Events" })
    ).toBeVisible();
    const hasEvents = await page.locator('a:has-text("Register →")').count() > 0;
    const hasEmpty = await page.getByText("No upcoming events at this time.").count() > 0;
    expect(hasEvents || hasEmpty).toBe(true);
  });

  test("nav is present on /church/events (layout applied)", async ({ page }) => {
    await page.goto("/church/events");
    await expect(page.getByRole("link", { name: "JLY Church" })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Events", exact: true })).toBeVisible();
  });
});
