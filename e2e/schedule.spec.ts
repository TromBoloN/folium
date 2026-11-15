import { expect, type Page, test } from "@playwright/test";
import { localDate, signUp, waitForContent, waitForHydration } from "./helpers";

const toast = (page: Page) => page.getByRole("region", { name: "Notifications" });
const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

/** A fresh user with one course that meets tomorrow 10:00–11:40. Returns tomorrow's date. */
async function setUp(page: Page) {
  await signUp(page);
  await page.goto("/courses/new");
  await page.getByLabel("Name").fill("Physics I");
  await page.getByLabel("Code").fill("FIS101");
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  const tomorrow = localDate(1);
  await page.goto(`/courses/timetable/new?weekday=${isoWeekday(tomorrow)}&start=10:00&week=${tomorrow}`);
  await page.getByRole("button", { name: "Add class time" }).click();
  await expect(page).toHaveURL(/view=week/);
  return tomorrow;
}

async function openDay(page: Page, date: string) {
  await page.goto(`/courses?view=day&week=${date}`);
  await waitForContent(page);
  await waitForHydration(page);
}

const row = (page: Page, status: string) => page.locator(`main a[data-status="${status}"]`, { hasText: "Physics I" });

test("cancel a class in one tap from the by-day list, then undo", async ({ page }) => {
  const tomorrow = await setUp(page);
  await openDay(page, tomorrow);
  await row(page, "scheduled").first().click();
  const sheet = page.getByRole("dialog", { name: "Class" });
  await sheet.getByRole("button", { name: "Cancelled" }).click();
  await expect(toast(page)).toContainText("Cancelled FIS101");
  await expect(row(page, "cancelled").first()).toContainText("Cancelled");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, "scheduled").first()).toBeVisible();
  await expect(row(page, "cancelled")).toHaveCount(0);
});

test("move a class this week only: the end follows, the week shows where it came from", async ({ page }) => {
  const tomorrow = await setUp(page);
  await openDay(page, tomorrow);
  await row(page, "scheduled").first().click();
  const sheet = page.getByRole("dialog", { name: "Class" });
  await sheet.getByRole("button", { name: "Moved" }).click();
  await sheet.getByLabel("Starts").fill("13:00");
  await expect(sheet.getByLabel("Ends")).toHaveValue("14:40");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(toast(page)).toContainText("Moved FIS101");
  await expect(row(page, "moved").first()).toContainText("Moved from 10:00");
  // Only that date: the week after is untouched.
  await openDay(page, localDate(8));
  await expect(row(page, "scheduled").first()).toContainText("10:00–11:40");
});

test("typed commands in Ctrl+K and a break range", async ({ page }) => {
  const tomorrow = await setUp(page);
  await openDay(page, tomorrow);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("cancel physics tomorrow");
  await expect(page.getByRole("option", { name: /Cancel FIS101/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(toast(page)).toContainText("Cancelled FIS101");
  await expect(row(page, "cancelled").first()).toBeVisible();

  // A break next week cancels the class there too.
  const next = localDate(8);
  await page.goto(`/courses/breaks/new?from=${next}`);
  await page.getByLabel("Name").fill("Exam week");
  await page.getByRole("button", { name: "Add break" }).click();
  await expect(page).toHaveURL(/view=day/);
  await waitForContent(page);
  await expect(row(page, "cancelled").first()).toContainText("Cancelled · Exam week");
});

test("the view is remembered, the timetable URL redirects, and the calendar exports", async ({ page }) => {
  await setUp(page);
  await page.goto("/courses");
  await waitForHydration(page);
  await page.getByRole("link", { name: "By day" }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByRole("link", { name: "By day" })).toHaveAttribute("aria-current", "page");
  await expect
    .poll(async () => {
      await page.goto("/courses");
      return page.getByRole("link", { name: "By day" }).getAttribute("aria-current");
    })
    .toBe("page");

  await page.goto("/courses/timetable");
  await expect(page).toHaveURL(/\/courses\?view=week/);

  const ics = await page.request.get("/courses/calendar.ics");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("SUMMARY:Physics I");
});
