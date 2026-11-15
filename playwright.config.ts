import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and the local Supabase stack
 * (confirmation emails are read from Mailpit). Start both first:
 *   bunx supabase start && bun run build && bun run start
 * then: bun run test:e2e   (or set E2E_BASE_URL to test another server)
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
