import { expect, test as setup } from "@playwright/test";

/** Sign in once as the seeded demo account; the axe tests reuse this session. */
setup("sign in as the demo account", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@folium.test");
  await page.getByLabel("Password").fill("folium-demo-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: "playwright/.auth/demo.json" });
});
