import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { localDate, signUp, waitForContent } from "./helpers";

test("quick add, deadlines grouped by due state, complete a task", async ({ page }) => {
  await signUp(page);
  await page.goto("/tasks");
  await expect(page.getByText("No open tasks")).toBeVisible();

  const quickAdd = page.getByLabel("New task title");
  await quickAdd.fill("Read chapter 4");
  await quickAdd.press("Enter");
  await expect(page.getByRole("link", { name: "Read chapter 4" })).toBeVisible();
  await expect(quickAdd).toHaveValue("");

  for (const [title, date] of [
    ["Essay draft", localDate(-1)],
    ["Quiz prep", localDate(0)],
  ]) {
    await page.goto("/tasks/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await page.goto("/tasks");
  await expect(page.getByRole("region", { name: /Overdue/ })).toContainText("Essay draft");
  await expect(page.getByRole("region", { name: /Today/ })).toContainText("Quiz prep");
  await expect(page.getByRole("region", { name: /No deadline/ })).toContainText("Read chapter 4");

  await page.getByRole("button", { name: "Mark “Quiz prep” as done" }).click();
  await expect(page.getByRole("link", { name: /Quiz prep/ })).toHaveCount(0);
});

test("a rejected task form keeps what was typed", async ({ page }) => {
  await signUp(page);
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Lab report");
  await page.getByLabel("Time").fill("14:30");
  // Notes is one of the optional fields under "More details".
  await page.getByText("More details").click();
  await page.getByLabel("Notes").fill("Include the graphs");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText("Add a date for this time.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Lab report");
  await expect(page.getByLabel("Time")).toHaveValue("14:30");
  // "More details" stays open when it holds something typed, so it isn't hidden after the error.
  await expect(page.getByLabel("Notes")).toBeVisible();
  await expect(page.getByLabel("Notes")).toHaveValue("Include the graphs");
});

test("School: one sidebar item for Courses, Tasks and Grades, with a shared tab bar", async ({ page }) => {
  await signUp(page);
  await page.goto("/tasks");
  await waitForContent(page);
  const sidebar = page.getByRole("navigation", { name: "Main" }).first();
  await expect(sidebar.getByRole("link", { name: "School" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: "Tasks" })).toHaveCount(0);

  const tabs = page.getByRole("navigation", { name: "School" });
  await expect(tabs.getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Grades" }).click();
  await expect(page).toHaveURL(/\/grades$/);
  await expect(tabs.getByRole("link", { name: "Grades" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: "School" })).toHaveAttribute("aria-current", "page");
});

test("/tasks has no axe violations (WCAG 2.2 A/AA)", async ({ page }) => {
  await signUp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tasks");
  await waitForContent(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
