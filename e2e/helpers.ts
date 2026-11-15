import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
export const TEST_PASSWORD = "correct-horse-1";

/** The first link in the newest email to `email` whose subject contains `subject`. Polls Mailpit. */
export async function emailLink(email: string, subject: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:${email} subject:"${subject}"`);
        const search = await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json();
        if (!search.messages.length) return false;
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${search.messages[0].ID}`)).json();
        link = msg.HTML.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return link as string;
}

/** Signs up a fresh user and confirms the email through Mailpit, leaving the page signed in. */
export async function signUp(page: Page) {
  const email = `e2e-${crypto.randomUUID().slice(0, 8)}@test.local`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await emailLink(email, "Confirm"));
  await expect(page).toHaveURL(/\/$/);
  // The link points at the configured site URL, which may not be the server under test.
  await page.goto("/");
  return email;
}

/** Today's date (YYYY-MM-DD) in the default user time zone, offset by some days. */
export function localDate(offsetDays: number, timeZone = "Asia/Makassar") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

/** Waits until no loading skeletons remain (every Suspense boundary has streamed in). */
export async function waitForContent(page: Page) {
  await expect(page.locator('[role="status"][aria-label^="Loading"]')).toHaveCount(0, { timeout: 15_000 });
}

/** Waits until the app's client code is running, so clicks use the JS paths (toasts, sheets, undo). */
export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 15_000 });
}
