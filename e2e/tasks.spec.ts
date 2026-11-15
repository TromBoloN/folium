import { expect, test } from "@playwright/test";
import { localDate, signUp } from "./helpers";

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
  await page.getByLabel("Notes").fill("Include the graphs");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText("Add a date for this time.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Lab report");
  await expect(page.getByLabel("Time")).toHaveValue("14:30");
  await expect(page.getByLabel("Notes")).toHaveValue("Include the graphs");
});
