// app/tests/e2e/admin-smoke.spec.ts
// Smoke test: every static admin route renders for a staff session.
import { test, expect } from "@playwright/test";

const STAFF_EMAIL = "admin@jly.church";
const STAFF_PASSWORD = "changeme";

const ADMIN_ROUTES = [
  "/members",
  "/members/new",
  "/members/applications",
  "/events",
  "/events/new",
  "/events/attendance",
  "/events/series",
  "/events/series/new",
  "/programs/bac",
  "/programs/bac/new",
  "/programs/heartlink",
  "/programs/heartlink/new",
  "/education/bc/offerings",
  "/education/bc/students",
  "/education/bc/students/new",
  "/education/isu/sessions",
  "/education/isu/sessions/new",
  "/education/isu/students",
  "/education/isu/students/new",
  "/ministries",
  "/missions/scholarships",
  "/missions/scholarships/new",
  "/announcements",
  "/announcements/new",
  "/ghl",
  "/users",
];

test.describe("Admin route smoke", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("all static admin routes render with an h1 and no error page", async ({
    page,
  }) => {
    // 26 routes; first-compile in dev can take seconds each.
    test.setTimeout(180_000);
    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should return 200`).toBe(200);
      await expect(
        page.getByRole("heading").first(),
        `${route} should render a heading`
      ).toBeVisible();
      await expect(
        page.getByText("Application error"),
        `${route} should not show an error boundary`
      ).toHaveCount(0);
    }
  });
});
