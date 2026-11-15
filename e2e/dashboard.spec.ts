import { expect, type Page, test } from "@playwright/test";
import { localDate, signUp, waitForContent } from "./helpers";

const TZ = "Asia/Makassar";

/** Current local time in the default zone, shifted by some minutes, as "HH:MM". */
function localTime(offsetMinutes: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Date.now() + offsetMinutes * 60_000));
}

function widget(page: Page, title: string) {
  return page.getByRole("region", { name: title });
}

async function widgetTitles(page: Page) {
  return page.locator("section[aria-labelledby^='widget-'] h2").allInnerTexts();
}

test("sign up, add a task due today, see it on the dashboard", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)/);
  await expect(widget(page, "Today's classes")).toContainText("No classes today");
  await expect(widget(page, "Overdue")).toContainText("Nothing overdue");
  await expect(widget(page, "Due soon")).toContainText("Nothing due");

  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Hand in essay");
  await page.getByLabel("Date").fill(localDate(0));
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("heading", { name: "Hand in essay" })).toBeVisible();

  await page.goto("/");
  await expect(widget(page, "Due soon")).toContainText("Hand in essay");
  await expect(widget(page, "Due soon")).toContainText("Today");

  // Quick add from the dashboard; a task with no deadline doesn't belong in "Due soon".
  const quickAdd = widget(page, "Quick add").getByLabel("New task title");
  await quickAdd.fill("Buy lab coat");
  await quickAdd.press("Enter");
  await expect(quickAdd).toHaveValue("");
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Buy lab coat" })).toBeVisible();
});

test("today's classes highlight what's on now and next", async ({ page }) => {
  const minutes = Number(localTime(0).slice(0, 2)) * 60 + Number(localTime(0).slice(3));
  test.skip(minutes < 60 || minutes > 21 * 60, "needs room before and after now on the same local day");

  await signUp(page);
  await page.goto("/courses/new");
  await page.getByLabel("Name").fill("Calculus");
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  const courseUrl = page.url();

  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" }).format(new Date());
  for (const [start, end] of [
    [localTime(-30), localTime(30)],
    [localTime(90), localTime(150)],
  ]) {
    await page.goto(`${courseUrl}/slots/new`);
    await page.getByLabel("Day").selectOption({ label: weekday });
    await page.getByLabel("Starts").fill(start);
    await page.getByLabel("Ends").fill(end);
    await page.getByRole("button", { name: "Add class time" }).click();
    await expect(page).toHaveURL(courseUrl);
  }

  await page.goto("/");
  const classes = widget(page, "Today's classes");
  await expect(classes.getByRole("listitem")).toHaveCount(2);
  await expect(classes.getByRole("listitem").nth(0)).toContainText("Now");
  await expect(classes.getByRole("listitem").nth(1)).toContainText("Next");
});

test("customize: hide and reorder widgets, saved across reloads", async ({ page }) => {
  await signUp(page);
  await waitForContent(page);
  expect(await widgetTitles(page)).toEqual(["Today's classes", "Due soon", "Overdue", "Quick add", "Grades"]);

  await page.getByRole("link", { name: "Customize" }).click();
  await expect(page.getByRole("heading", { name: "Customize your dashboard" })).toBeVisible();
  // The editor is a client component; wait until it has hydrated before clicking.
  await page.locator("form[data-ready]").waitFor();

  // Hide "Overdue", move "Quick add" to the top with the buttons.
  await page.getByLabel("Show Overdue").uncheck();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Move Quick add up" }).click();
  await expect(page.getByRole("button", { name: "Move Quick add up" })).toBeDisabled();

  // Keyboard drag: pick up "Due soon", move it up one place, drop.
  // Wait for each screen-reader announcement, so keys aren't pressed faster than dnd-kit handles them.
  await page.getByRole("button", { name: "Reorder Due soon" }).focus();
  await page.keyboard.press("Space");
  // The live region keeps only the latest message; picking up reports the starting position.
  await expect(page.getByText("Due soon is now at position 3 of 5.")).toBeAttached();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByText("Due soon is now at position 2 of 5.")).toBeAttached();
  await page.keyboard.press("Space");
  await expect(page.getByText("Due soon dropped at position 2.")).toBeAttached();
  const rows = page.locator("form ul > li");
  await expect(rows.nth(1)).toContainText("Due soon");

  await page.getByRole("button", { name: "Save layout" }).click();
  await expect(page).toHaveURL(/\/$/);
  const expected = ["Quick add", "Due soon", "Today's classes", "Grades"];
  await expect.poll(() => widgetTitles(page)).toEqual(expected);

  await page.reload();
  await expect.poll(() => widgetTitles(page)).toEqual(expected);

  // Reset brings everything back in the default order.
  await page.getByRole("link", { name: "Customize" }).click();
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.getByRole("button", { name: "Save layout" }).click();
  await expect
    .poll(() => widgetTitles(page))
    .toEqual(["Today's classes", "Due soon", "Overdue", "Quick add", "Grades"]);
});
