import { expect, type Page, test } from "@playwright/test";
import { signUp, waitForContent, waitForHydration } from "./helpers";

async function addCourse(page: Page, name: string, credits: string, semester: string) {
  await page.goto("/courses/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Semester").fill(semester);
  await page.getByLabel("Credits (SKS)").fill(credits);
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
}

async function addAssessment(
  page: Page,
  courseId: string,
  a: { name: string; weight: string; score?: string; max?: string },
) {
  await page.goto(`/grades/${courseId}/assessments/new`);
  await page.getByLabel("Name").fill(a.name);
  await page.getByLabel("Weight (% of the course grade)").fill(a.weight);
  if (a.max) await page.getByLabel("Out of").fill(a.max);
  if (a.score) await page.getByLabel("Score").fill(a.score);
  await page.getByRole("button", { name: "Add assessment" }).click();
  await expect(page).toHaveURL(new RegExp(`/grades/${courseId}$`));
}

test("grades: assessments → course grade → what I need → GPA → dashboard widget", async ({ page }) => {
  // A long flow (two courses, four assessments, several pages); under parallel mobile runs it nears 30s.
  test.setTimeout(60_000);
  await signUp(page);

  await page.goto("/grades");
  await expect(page.getByText("No courses yet")).toBeVisible();

  const calc = await addCourse(page, "Calculus", "3", "2026 Ganjil");
  const phys = await addCourse(page, "Physics", "2", "2026 Ganjil");

  // A rejected assessment keeps what was typed.
  await page.goto(`/grades/${calc}/assessments/new`);
  await page.getByLabel("Name").fill("Quiz 1");
  await page.getByLabel("Weight (% of the course grade)").fill("20");
  await page.getByLabel("Out of").fill("20");
  await page.getByLabel("Score").fill("25");
  await page.getByRole("button", { name: "Add assessment" }).click();
  await expect(page.getByText("Score can't be more than the maximum.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Quiz 1");
  await expect(page.getByLabel("Out of")).toHaveValue("20");

  // Calculus: 18/20 = 90% at 20%, 70% at 30%, final (50%) not graded → 78% so far → B+.
  await addAssessment(page, calc, { name: "Quiz 1", weight: "20", score: "18", max: "20" });
  await addAssessment(page, calc, { name: "Midterm", weight: "30", score: "70" });
  await addAssessment(page, calc, { name: "Final", weight: "50" });

  await page.goto(`/grades/${calc}`);
  const standing = page.getByRole("region", { name: "Current standing" });
  await expect(standing).toContainText("B+");
  await expect(standing).toContainText("78.0%");
  await expect(standing).toContainText("50%");

  // Target A (85%): earned 39 of 100; need (8500 - 3900) / 50 = 92%.
  await page.getByLabel("Target grade").selectOption("A");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByRole("region", { name: "What do I need?" })).toContainText("average of 92.0%");
  // Target E is already secured.
  await page.getByLabel("Target grade").selectOption("E");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByRole("region", { name: "What do I need?" })).toContainText("already secured");

  // Physics: one assessment at 90% → A (4.0), weights only 40% → warning.
  await addAssessment(page, phys, { name: "Lab", weight: "40", score: "90" });
  await expect(page.getByText("Weights add up to 40%, not 100%.")).toBeVisible();

  // GPA: Calculus B+ (3.5) × 3 + Physics A (4.0) × 2 = 18.5 / 5 = 3.70.
  await page.goto("/grades");
  await waitForContent(page);
  await expect(page.getByText("GPA · 2026 Ganjil")).toBeVisible();
  await expect(page.locator("main")).toContainText("3.70");
  await expect(page.locator("main")).toContainText("5 SKS counted");

  // Edit a score: Midterm 70 → 100: (1800 + 3000) / 50 = 96% → A.
  await page.goto(`/grades/${calc}`);
  await waitForHydration(page);
  await page.getByRole("link", { name: "Edit Midterm" }).click();
  // Opens as a sheet over the course page (whose list has inline score fields too).
  const sheet = page.getByRole("dialog", { name: "Edit assessment" });
  await sheet.getByLabel("Score").fill("100");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current standing" })).toContainText("96.0%");

  // Delete it again: back to Quiz only → 90%.
  await page.getByRole("button", { name: "Delete Midterm" }).click();
  await expect(page.getByRole("link", { name: "Edit Midterm" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current standing" })).toContainText("90.0%");

  // Dashboard widget (added through the registry; appears for this user automatically).
  await page.goto("/");
  const widget = page.getByRole("region", { name: "Grades" });
  await expect(widget).toContainText("GPA so far");
  await expect(widget).toContainText("Calculus");
  await expect(widget).toContainText("Physics");
});

test("grade scale is a preference; a bad scale is rejected and kept for fixing", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
  await waitForContent(page);
  // Settings save as you change them, once the form has hydrated.
  await expect(page.getByText("Changes save as you make them.")).toBeVisible();
  await page.getByLabel("Minimum percentage, row 1").fill("");
  await expect(page.getByText("Minimum must be a number.")).toBeVisible();
  await expect(page.getByLabel("Minimum percentage, row 1")).toHaveValue("");

  await page.getByRole("button", { name: "Use the Indonesian 4.0 scale" }).click();
  await page.getByLabel("Minimum percentage, row 1").fill("90");
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await waitForContent(page);
  await expect(page.getByLabel("Minimum percentage, row 1")).toHaveValue("90");
});

test("another user can't see someone else's course grades", async ({ browser }) => {
  const owner = await browser.newPage();
  await signUp(owner);
  const courseId = await addCourse(owner, "Private course", "3", "2026 Ganjil");
  await addAssessment(owner, courseId, { name: "Secret quiz", weight: "50", score: "99" });

  const other = await browser.newPage();
  await signUp(other);
  await other.goto(`/grades/${courseId}`);
  await waitForContent(other);
  await expect(other.getByRole("heading", { name: "Not found" })).toBeVisible();
  await expect(other.locator("main")).not.toContainText("Secret quiz");
  await expect(other.locator("main")).not.toContainText("Private course");
  await other.goto("/grades");
  await waitForContent(other);
  await expect(other.locator("main")).not.toContainText("Private course");
});
