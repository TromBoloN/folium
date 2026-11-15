// Visual check of every main page, for design reviews.
//
//   bun run db:seed && node scripts/visual-check.mjs <phase>
//
// Saves docs/screenshots/<phase>/<page>-<preset>-<mode>-<width>.png for
// {light, dark} x {1440, 390} x {green, violet}, signed in as the demo account.
// The theme is set straight in the database (and restored at the end), so the
// run doesn't depend on the settings form. Needs the app running (BASE_URL,
// default http://127.0.0.1:3100) and the local Supabase stack.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const phase = process.argv[2];
if (!phase) {
  console.error("usage: node scripts/visual-check.mjs <phase>");
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = new URL(`../docs/screenshots/${phase}/`, import.meta.url).pathname;
const DEMO = { email: "demo@folium.test", password: "folium-demo-2026" };
const PAGES = [
  { name: "today", path: "/" },
  { name: "courses", path: "/courses" },
  { name: "timetable", path: "/courses/timetable" },
  { name: "tasks", path: "/tasks" },
  { name: "grades", path: "/grades" },
  { name: "settings", path: "/settings" },
];
const PRESETS = ["green", "violet"];
const MODES = ["light", "dark"];
const WIDTHS = [1440, 390];

function sql(query) {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_folium-web", "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8" },
  ).trim();
}
const DEMO_USER = `(select id from auth.users where email = '${DEMO.email}')`;
const setTheme = (json) => sql(`update public.user_settings set theme = '${json}'::jsonb where user_id = ${DEMO_USER}`);

mkdirSync(OUT, { recursive: true });
const savedTheme = sql(`select theme::text from public.user_settings where user_id = ${DEMO_USER}`);
const browser = await chromium.launch();

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", DEMO.email);
  await page.fill("#password", DEMO.password);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  return page;
}

async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label^="Loading"]'), null, {
    timeout: 20_000,
  });
  // Let entrance animations finish (they are < 600ms by design).
  await page.waitForTimeout(900);
}

try {
  for (const width of WIDTHS) {
    const mobile = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await signIn(context);
    for (const preset of PRESETS) {
      for (const mode of MODES) {
        setTheme(JSON.stringify({ mode, preset }));
        for (const shot of PAGES) {
          await page.goto(`${BASE}${shot.path}`);
          await settle(page);
          const file = `${shot.name}-${preset}-${mode}-${width}.png`;
          await page.screenshot({ path: `${OUT}${file}`, fullPage: true });
          console.log(`saved ${phase}/${file}`);
        }
      }
    }
    await context.close();
  }
} finally {
  setTheme(savedTheme);
  await browser.close();
}
