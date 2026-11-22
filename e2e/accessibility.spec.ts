import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { localDate, waitForContent } from "./helpers";

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
  // Check final states, not frames of an entrance fade (reduced motion renders everything settled).
  await page.emulateMedia({ reducedMotion: "reduce" });
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

/**
 * Links into the seeded demo account (bun run db:seed): a course with class
 * times, changes and attendance, a task with steps, an assessment, a class.
 */
async function demoIds(page: Page) {
  await page.goto("/courses?view=cards");
  await waitForContent(page);
  const courseHref = await page.locator("main a", { hasText: "Calculus I" }).first().getAttribute("href");
  const courseId = (courseHref as string).split("/").pop() as string;
  await page.goto(`/courses/${courseId}`);
  await waitForContent(page);
  const slotEdit = await page
    .getByRole("link", { name: /^Edit Monday class/ })
    .first()
    .getAttribute("href");
  const classHref = await page.locator('main a[href^="/courses/class/"]').first().getAttribute("href");
  await page.goto("/tasks");
  await waitForContent(page);
  const taskHref = await page.locator('main a[href^="/tasks/"]').first().getAttribute("href");
  await page.goto(`/grades/${courseId}`);
  await waitForContent(page);
  const assessmentEdit = await page
    .getByRole("link", { name: /^Edit / })
    .first()
    .getAttribute("href");
  return {
    courseId,
    taskId: (taskHref as string).split("/").pop() as string,
    slotEdit: slotEdit as string,
    classPage: classHref as string,
    assessmentEdit: assessmentEdit as string,
  };
}

async function applyTheme(page: Page, mode: string, preset: string) {
  await page.goto("/settings");
  await waitForContent(page);
  await expect(page.getByText("Changes save as you make them.")).toBeVisible();
  await page.locator(`label:has(input[name="mode"][value="${mode}"])`).click();
  await page.locator(`label:has(input[name="preset"][value="${preset}"])`).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
}

test.describe("signed-out pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const mode of MODES) {
    test(`${mode} mode`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "a11y-mobile", "checked once, on desktop");
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
  // Leave the demo account on its default look.
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: "playwright/.auth/demo.json" });
    await applyTheme(page, "system", "green");
    await page.close();
  });

  for (const mode of MODES) {
    for (const preset of PRESETS) {
      test(`${mode} · ${preset}`, async ({ page }, testInfo) => {
        // The mobile layout is checked for the default preset; desktop runs the full matrix.
        test.skip(testInfo.project.name === "a11y-mobile" && preset !== "green", "full matrix runs on desktop");
        test.setTimeout(180_000);

        const ids = await demoIds(page);
        await applyTheme(page, mode, preset);

        const paths = [
          "/",
          "/?edit=1",
          "/courses?view=cards",
          "/courses?view=day",
          `/courses?view=week&week=${localDate(0)}`,
          `/courses?view=day&week=${localDate(14)}`,
          ids.classPage,
          "/courses/extra/new",
          "/courses/breaks/new",
          "/courses/rollover",
          "/courses/new",
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
          "/themes",
          "/money/categories",
          "/money",
          "/money/sync",
          "/money/transactions",
          "/money/new",
          "/money/accounts",
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
