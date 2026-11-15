import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { localDate, signUp, waitForContent } from "./helpers";

/**
 * Accessibility: every page, in light and dark mode, across every colour
 * preset, checked with axe against WCAG 2.2 A/AA. Violations from all pages are
 * collected and reported together so one run shows everything to fix.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PRESETS = ["green", "blue", "violet", "orange", "rose"] as const;
const MODES = ["light", "dark"] as const;

type Finding = { page: string; rule: string; impact: string; nodes: string[] };

async function scan(page: Page, label: string, findings: Finding[]) {
  await waitForContent(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  for (const v of violations) {
    findings.push({
      page: label,
      rule: v.id,
      impact: v.impact ?? "unknown",
      nodes: v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
    });
  }
}

function report(findings: Finding[]) {
  return findings.map((f) => `\n[${f.impact}] ${f.rule} on ${f.page}\n  ${f.nodes.join("\n  ")}`).join("");
}

/** A small but complete data set so lists, the week grid and grades aren't empty. */
async function seedData(page: Page) {
  await page.goto("/courses/new");
  await page.getByLabel("Name").fill("Calculus");
  await page.getByLabel("Code").fill("MAT101");
  await page.getByLabel("Room").fill("B2.04");
  await page.getByLabel("Credits (SKS)").fill("3");
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  const courseId = page.url().split("/").pop() as string;

  for (const [weekday, start, end] of [
    ["1", "08:00", "10:00"],
    ["1", "09:00", "10:40"], // overlap, so the warning icon is checked too
    ["3", "13:00", "14:40"],
  ]) {
    await page.goto(`/courses/${courseId}/slots/new`);
    await page.getByLabel("Day").selectOption(weekday);
    await page.getByLabel("Starts").fill(start);
    await page.getByLabel("Ends").fill(end);
    await page.getByRole("button", { name: "Add class time" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
  }
  const slotEdit = await page
    .getByRole("link", { name: /^Edit Monday class/ })
    .first()
    .getAttribute("href");

  for (const [title, date, priority] of [
    ["Essay draft", localDate(-1), "high"],
    ["Quiz prep", localDate(0), "urgent"],
    ["Lab report", localDate(1), "medium"],
  ]) {
    await page.goto("/tasks/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Course").selectOption({ label: "Calculus" });
    await page.getByLabel("Date").fill(date);
    await page.locator(`label:has(input[name="priority"][value="${priority}"])`).click();
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);
  }
  const taskId = page.url().split("/").pop() as string;
  await page.getByLabel("New step").fill("Collect data");
  await page.getByLabel("New step").press("Enter");
  await expect(page.getByText("Collect data", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark “Collect data” as done" }).click();
  await expect(page.getByText("1 of 1 done")).toBeVisible();

  for (const [name, weight, score] of [
    ["Quiz", "20", "85"],
    ["Final exam", "80", ""],
  ]) {
    await page.goto(`/grades/${courseId}/assessments/new`);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Weight (% of the course grade)").fill(weight);
    if (score) await page.getByLabel("Score").fill(score);
    await page.getByRole("button", { name: "Add assessment" }).click();
    await expect(page).toHaveURL(new RegExp(`/grades/${courseId}$`));
  }
  const assessmentEdit = await page.getByRole("link", { name: "Edit Quiz" }).getAttribute("href");

  return { courseId, taskId, slotEdit: slotEdit as string, assessmentEdit: assessmentEdit as string };
}

async function applyTheme(page: Page, mode: string, preset: string) {
  await page.goto("/settings");
  await waitForContent(page);
  await page.locator(`label:has(input[name="mode"][value="${mode}"])`).click();
  await page.locator(`label:has(input[name="preset"][value="${preset}"])`).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
}

test.describe("signed-out pages", () => {
  for (const mode of MODES) {
    test(`${mode} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      const findings: Finding[] = [];
      for (const path of ["/login", "/signup", "/forgot-password", "/login?error=confirm_failed"]) {
        await page.goto(path);
        await scan(page, `${path} (${mode})`, findings);
      }
      // A form showing its errors.
      await page.goto("/signup");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await scan(page, `/signup with errors (${mode})`, findings);
      expect(findings, report(findings)).toEqual([]);
    });
  }
});

test.describe("signed-in pages", () => {
  test.describe.configure({ mode: "parallel" });

  for (const mode of MODES) {
    for (const preset of PRESETS) {
      test(`${mode} · ${preset}`, async ({ page }, testInfo) => {
        // The mobile layout is checked for the default preset; desktop runs the full matrix.
        test.skip(testInfo.project.name === "mobile" && preset !== "green", "full matrix runs on desktop");
        test.setTimeout(180_000);

        await signUp(page);
        const ids = await seedData(page);
        await applyTheme(page, mode, preset);

        const paths = [
          "/",
          "/?edit=1",
          "/courses",
          "/courses/new",
          `/courses/timetable?week=${localDate(0)}`,
          `/courses/${ids.courseId}`,
          `/courses/${ids.courseId}/edit`,
          `/courses/${ids.courseId}/slots/new`,
          ids.slotEdit,
          "/tasks",
          "/tasks?status=done",
          "/tasks?due=overdue",
          "/tasks/new",
          `/tasks/${ids.taskId}`,
          `/tasks/${ids.taskId}/edit`,
          "/grades",
          `/grades/${ids.courseId}`,
          `/grades/${ids.courseId}?target=A`,
          `/grades/${ids.courseId}/assessments/new`,
          ids.assessmentEdit,
          "/settings",
          "/update-password",
          "/courses/00000000-0000-4000-8000-000000000000",
        ];

        const findings: Finding[] = [];
        for (const path of paths) {
          await page.goto(path);
          await scan(page, `${path} (${mode}, ${preset})`, findings);
        }

        // Forms showing validation errors.
        await page.goto("/courses/new");
        await page.getByRole("button", { name: "Add course" }).click();
        await expect(page.getByText("Give the course a name.")).toBeVisible();
        await scan(page, `/courses/new with errors (${mode}, ${preset})`, findings);
        await page.goto("/tasks/new");
        await page.getByLabel("Time").fill("10:00");
        await page.getByRole("button", { name: "Add task" }).click();
        await expect(page.getByText("Add a date for this time.")).toBeVisible();
        await scan(page, `/tasks/new with errors (${mode}, ${preset})`, findings);

        expect(findings, report(findings)).toEqual([]);
      });
    }
  }
});
