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
  await expect(card(page)).toHaveAccessibleName(/balance\s*Rp 0\s/);

  await page.goto("/money/new");
  await waitForContent(page);
  await page.getByLabel("Amount", { exact: true }).fill("32.500");
  // Accounts are chips (radios) showing their balance.
  await page
    .getByRole("group", { name: "Account" })
    .getByRole("radio", { name: new RegExp(LIVIN) })
    .check();
  await page.getByLabel("Payee").fill("GoFood");
  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(page).toHaveURL(/\/money$/);
  await waitForContent(page);
  await expect(card(page)).toHaveAccessibleName(/balance\s*-Rp 32\.500\s/);
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

test("a recurring bill can be added and marked paid, and every Money tab opens", async ({ page }) => {
  await signUp(page);
  await page.goto("/money/recurring/new?template=kos");
  await waitForContent(page);
  await page.getByLabel("Amount", { exact: true }).fill("900k");
  await page.getByLabel("Starts").fill(await page.evaluate(() => new Date().toISOString().slice(0, 10)));
  await page.getByLabel("Due day").fill(String(new Date().getDate()));
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page).toHaveURL(/\/money\/recurring$/);
  await waitForContent(page);
  await page
    .getByRole("button", { name: /Mark paid\s*:\s*Kos/ })
    .first()
    .click();
  await expect(page.getByText(/Paid: Kos/).first()).toBeVisible();

  for (const [path, heading] of [
    ["/money/budgets", /No budgets for this month|Set a budget/],
    ["/money/goals", /No goals yet|New goal/],
    ["/money/debts", /Split a bill/],
    ["/money/reports", /In and out|Nothing to report yet/],
    ["/money/import", /Import a CSV/],
    ["/money/categories", /Categories/],
  ] as const) {
    await page.goto(path);
    await waitForContent(page);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});
