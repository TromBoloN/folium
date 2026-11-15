import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Signs up a fresh user and confirms the email through Mailpit, leaving the page signed in. */
export async function signUp(page: Page) {
  const email = `e2e-${crypto.randomUUID().slice(0, 8)}@test.local`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  let link: string | undefined;
  await expect
    .poll(async () => {
      const search = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
      if (!search.messages.length) return false;
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${search.messages[0].ID}`)).json();
      link = msg.HTML.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
      return true;
    })
    .toBe(true);
  // The link uses the configured site URL; cookies are per host, not per port.
  await page.goto(link as string);
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
