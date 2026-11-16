import { expect, type Page, test } from "@playwright/test";
import { localDate, signUp, waitForContent, waitForHydration } from "./helpers";

const toast = (page: Page) => page.getByRole("region", { name: "Notifications" });

async function addCourse(page: Page, name: string, code: string) {
  await page.goto("/courses/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
}

async function openAdd(page: Page) {
  await waitForHydration(page);
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "Add a task" })).toBeVisible();
}

test("first run: the setup checklist ticks itself off", async ({ page }) => {
  await signUp(page);
  const setup = page.getByRole("region", { name: "Set up Folium" });
  await expect(setup).toContainText("0/3");
  await addCourse(page, "Academic English", "ING101");
  await page.goto("/");
  await expect(setup).toContainText("1/3");
  await expect(setup).toContainText("Add your first course (done)");
});

test("one-line quick add understands date, time, course and priority; undo removes it", async ({ page }) => {
  await signUp(page);
  await addCourse(page, "Academic English", "ING101");
  await page.goto("/tasks");
  await openAdd(page);
  await page.getByRole("combobox", { name: "New task" }).fill("Essay outline tomorrow 5pm #ING101 !high");
  // The preview shows what was understood before saving.
  await expect(page.getByRole("dialog")).toContainText("ING101");
  await page.keyboard.press("Enter");
  await expect(toast(page)).toContainText("Added: Essay outline");

  const row = page.getByRole("main").getByRole("listitem").filter({ hasText: "Essay outline" });
  await expect(row).toContainText("ING101");
  await expect(row).toContainText("Tomorrow 17:00");
  await expect(row).toContainText("High");

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: /Essay outline/ })).toHaveCount(0);
});

test("complete with undo, and push an overdue task to today", async ({ page }) => {
  await signUp(page);
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Late lab report");
  await page.getByLabel("Date").fill(localDate(-1));
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);

  await page.goto("/tasks?due=overdue");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Move “Late lab report” to today" }).click();
  await expect(toast(page)).toContainText("Moved to today");
  await expect(page.getByRole("link", { name: /Late lab report/ })).toHaveCount(0);

  await page.goto("/tasks?due=today");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Mark “Late lab report” as done" }).click();
  // The row leaves at once, before the server answers.
  await expect(page.getByRole("link", { name: /Late lab report/ })).toHaveCount(0);
  await expect(toast(page)).toContainText("Done: Late lab report");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: /Late lab report/ })).toBeVisible();
});

test("add and open tasks in a sheet without leaving the list", async ({ page }) => {
  await signUp(page);
  await page.goto("/tasks");
  await waitForHydration(page);
  await page.getByRole("link", { name: "New task" }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  const sheet = page.getByRole("dialog", { name: "New task" });
  await sheet.getByLabel("Title").fill("Buy lab coat");
  await sheet.getByRole("button", { name: "Add task" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(toast(page)).toContainText("Task added");
  await expect(page.getByRole("link", { name: /Buy lab coat/ })).toBeVisible();

  // Open it in a sheet, rename it in place, close it.
  await page.getByRole("link", { name: /Buy lab coat/ }).click();
  const detail = page.getByRole("dialog", { name: "Task" });
  await detail.getByRole("button", { name: "Rename: Buy lab coat" }).click();
  await detail.getByLabel("Task title").fill("Buy a lab coat");
  await detail.getByLabel("Task title").press("Enter");
  await expect(toast(page)).toContainText("Renamed");
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("link", { name: /Buy a lab coat/ })).toBeVisible();
});

test("search jumps to a task", async ({ page }) => {
  await signUp(page);
  await page.goto("/");
  await openAdd(page);
  await page.getByRole("combobox", { name: "New task" }).fill("Find this later");
  await page.keyboard.press("Enter");
  await expect(toast(page)).toContainText("Added: Find this later");

  // Shortcuts are ignored while a dialog is open: wait until the add box has closed.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search tasks, courses and pages" }).fill("this later");
  await expect(page.getByRole("option", { name: /Find this later/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);
  await waitForContent(page);
  await expect(page.getByRole("button", { name: "Rename: Find this later" })).toBeVisible();
});
