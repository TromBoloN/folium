// Captures the README screenshots of the demo account (the four images it shows).
// Needs the app running and fresh demo data:  bun run db:seed && bun run screenshots
// Output: .github/screenshots/*.png  (BASE_URL defaults to http://127.0.0.1:3000)
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = new URL("../.github/screenshots/", import.meta.url).pathname;
const DEMO = { email: "demo@folium.test", password: "folium-demo-2026" };

// name-device.png; keep in sync with README.md.
const SHOTS = [
  { name: "today", path: "/", devices: ["desktop"] },
  { name: "courses-day", path: "/courses?view=day", devices: ["desktop", "mobile"] },
  { name: "courses-week", path: "/courses?view=week", devices: ["desktop"] },
];

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await chromium.launch();
for (const [device, options] of Object.entries(DEVICES)) {
  const context = await browser.newContext({ ...options, colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", DEMO.email);
  await page.fill("#password", DEMO.password);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  for (const shot of SHOTS.filter((s) => s.devices.includes(device))) {
    await page.goto(`${BASE}${shot.path}`);
    // Wait until every Suspense boundary has streamed in.
    await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label^="Loading"]'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${shot.name}-${device}.png`, fullPage: device === "desktop" });
    console.log(`saved ${shot.name}-${device}.png`);
  }
  await context.close();
}
await browser.close();
