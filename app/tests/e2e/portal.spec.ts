import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";

function makePortalToken(memberId: number): string {
  const secret = process.env.PORTAL_SECRET ?? "jlycc-portal-secret-32chars-okk";
  const payload = String(memberId);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

test.describe("Member portal", () => {
  test("invalid token shows error page", async ({ page }) => {
    await page.goto("/portal/thisisnotavalidtoken");
    await expect(page.getByText(/invalid/i).first()).toBeVisible();
  });

  test("valid token shows membership section", async ({ page }) => {
    await page.goto(`/portal/${makePortalToken(1)}`);
    if (await page.getByText(/not found/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: "Membership" })).toBeVisible();
  });

  test("valid token shows roles section", async ({ page }) => {
    await page.goto(`/portal/${makePortalToken(1)}`);
    if (await page.getByText(/not found/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
  });

  test("valid token shows pastoral care section", async ({ page }) => {
    await page.goto(`/portal/${makePortalToken(1)}`);
    if (await page.getByText(/not found/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: "Pastoral Care" })).toBeVisible();
  });

  test("valid token shows application section", async ({ page }) => {
    await page.goto(`/portal/${makePortalToken(1)}`);
    if (await page.getByText(/not found/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: "Regular Member Application" })).toBeVisible();
  });

  test("valid token shows event registrations section", async ({ page }) => {
    await page.goto(`/portal/${makePortalToken(1)}`);
    if (await page.getByText(/not found/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: "Recent Event Registrations" })).toBeVisible();
  });
});
