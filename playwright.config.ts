import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "line",
  expect: { timeout: 10_000 },
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DASH_NETWORK: "testnet",
      DASH_ACADEMY_IDENTITY_ID: "e2e-identity",
      DASH_ACADEMY_PRIVATE_KEY_WIF: "e2e-private-key-never-used",
      DASH_ACADEMY_CONTRACT_ID: "e2e-contract",
      DASH_LEARNER_KEY_SALT: "dash-academy-e2e-learner-key-salt",
      DASH_SESSION_SECRET: "dash-academy-e2e-session-secret",
      // Outside outputDir, which Playwright empties at the start of every run.
      DASH_ACADEMY_E2E_STORE: path.resolve("test-results/e2e-store/progress.json"),
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_NAME: "Dash Academy E2E",
      WEBAUTHN_ORIGIN: baseURL,
    },
  },
});
