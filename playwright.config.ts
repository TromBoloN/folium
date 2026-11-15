import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and the local Supabase stack
 * (confirmation emails are read from Mailpit). Start both first:
 *   bunx supabase start && bun run build && bun run start
 * then: bun run test:e2e   (or set E2E_BASE_URL to test another server)
 *
 * test:e2e  the functional suite (desktop + mobile), fresh users per test.
 * test:a11y the axe matrix (every page × light/dark × every preset). It signs in
 *           once as the seeded demo account (run `bun run db:seed` first) and
 *           runs one test at a time: the theme is a per-user setting.
 */
const DEMO_STATE = "playwright/.auth/demo.json";
const A11Y = /accessibility\.spec\.ts/;
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Each test signs up a user and drives a full page; more workers starve the app server and time out.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", testIgnore: [A11Y, /\.setup\.ts/], use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testIgnore: [A11Y, /\.setup\.ts/], use: { ...devices["Pixel 7"] } },
    { name: "a11y-setup", testMatch: /a11y\.setup\.ts/ },
    {
      name: "a11y",
      testMatch: A11Y,
      fullyParallel: false,
      dependencies: ["a11y-setup"],
      use: { ...devices["Desktop Chrome"], storageState: DEMO_STATE },
    },
    {
      name: "a11y-mobile",
      testMatch: A11Y,
      fullyParallel: false,
      // After the desktop matrix, never alongside it: both change the demo account's theme.
      dependencies: ["a11y"],
      use: { ...devices["Pixel 7"], storageState: DEMO_STATE },
    },
  ],
});
