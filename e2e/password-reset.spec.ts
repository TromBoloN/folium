import { expect, test } from "@playwright/test";
import { emailLink, signUp, TEST_PASSWORD } from "./helpers";

test("reset a forgotten password through the emailed link", async ({ page }) => {
  const email = await signUp(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("link", { name: "Forgot password?" }).click();
  // The login page also has an Email field: wait for the navigation before typing.
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(`If an account exists for ${email}`)).toBeVisible();

  // The emailed link signs the user in and lands on /update-password.
  await page.goto(await emailLink(email, "Reset your Folium password"));
  await expect(page).toHaveURL(/\/update-password$/);
  await page.goto("/update-password");

  await page.getByLabel("New password", { exact: true }).fill("brand-new-pass-1");
  await page.getByLabel("Repeat new password").fill("brand-new-pass-2");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill("brand-new-pass-1");
  await page.getByLabel("Repeat new password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

  await page.getByLabel("Password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("reset requests look the same for unknown addresses (no account enumeration)", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody-here@test.local");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for nobody-here@test.local")).toBeVisible();
});

test("update-password needs a signed-in session", async ({ page }) => {
  await page.goto("/update-password");
  await expect(page).toHaveURL(/\/login\?next=%2Fupdate-password$/);
});
