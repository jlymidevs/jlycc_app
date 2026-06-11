// app/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

// Shared by the test process (token signing in specs) and the spawned dev
// server (token verification) so portal-token tests agree on the secret.
const E2E_PORTAL_SECRET =
  process.env.PORTAL_SECRET ?? "jlycc-portal-secret-32chars-okk";
process.env.PORTAL_SECRET = E2E_PORTAL_SECRET;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Production build: dev-mode route compiles + hydration gaps made
    // click-then-navigate tests flaky.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 300_000,
    env: {
      // E2E must NEVER run against the production (Neon) database.
      // Force the local docker-compose Postgres regardless of .env.
      DATABASE_URL:
        "postgresql://jly_admin:localdevpassword@localhost:5432/jly",
      DATABASE_URL_READER:
        "postgresql://jly_admin:localdevpassword@localhost:5432/jly",
      PORTAL_SECRET: E2E_PORTAL_SECRET,
      AUTH_TRUST_HOST: "true",
      // No real side effects from E2E: email + CRM sync become no-ops.
      RESEND_API_KEY: "",
      GHL_API_KEY: "",
    },
  },
});
