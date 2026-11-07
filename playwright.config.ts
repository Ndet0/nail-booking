import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    actionTimeout: 15_000,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @nailsbychao/api dev",
      url: "http://localhost:8787/api/v1/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @nailsbychao/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: /customer\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
