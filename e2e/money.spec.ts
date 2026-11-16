import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUp, waitForContent } from "./helpers";

const LIVIN = "Livin' by Mandiri";
const card = (page: import("@playwright/test").Page) =>
  page.getByRole("link", { name: new RegExp(`^${LIVIN}\\s*, Bank, balance`) });

test("adding an expense lowers that account's balance by exactly that amount", async ({ page }) => {
  await signUp(page);
  // First visit seeds the default accounts (all at Rp 0).
  await page.goto("/money");
  await waitForContent(page);
  await expect(card(page)).toHaveAccessibleName(/balance\s*Rp 0$/);

  await page.goto("/money/new");
  await waitForContent(page);
  await page.getByLabel("Amount", { exact: true }).fill("32.500");
  await page.getByLabel("Account", { exact: true }).selectOption({ label: LIVIN });
  await page.getByLabel("Payee").fill("GoFood");
  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(page).toHaveURL(/\/money$/);
  await waitForContent(page);
  await expect(card(page)).toHaveAccessibleName(/balance\s*-Rp 32\.500$/);
  await expect(page.getByRole("link", { name: /GoFood/ }).first()).toBeVisible();
});

test("/money has no axe violations (WCAG 2.2 A/AA)", async ({ page }) => {
  await signUp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/money");
  await waitForContent(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
