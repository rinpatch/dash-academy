import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator, passWhatIsDashQuiz } from "./helpers";

// Kept in step with DASH_ACADEMY_E2E_STORE in playwright.config.ts.
const STORE = path.resolve("test-results/e2e-store/progress.json");

test("offers to save when the first module is finished", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.goto("/learn/what-is-dash");
  await passWhatIsDashQuiz(page);

  const toasts = page.locator("[data-sonner-toaster]");
  await expect(toasts.getByText("Keep your progress")).toBeVisible();
  await toasts.getByRole("button", { name: "Save progress" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Save your progress")).toBeVisible();

  await dialog.getByRole("button", { name: "Create a passkey" }).click();
  await expect(page.getByText("Progress saved to Dash Platform")).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", {
      name: "Open passkey profile. Progress saves automatically.",
    }),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
});

test("the profile reopens a dismissed save offer", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.goto("/learn/what-is-dash");
  await passWhatIsDashQuiz(page);

  const toasts = page.locator("[data-sonner-toaster]");
  await toasts.getByRole("button", { name: "Save progress" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toBeHidden();

  await expect(
    page.locator("header").getByRole("button", { name: "Save progress" }),
  ).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "Open passkey profile" }).click();
  await expect(page.getByRole("dialog").getByText("Save your progress")).toBeVisible();
});

test("a failed push is reported and can be retried", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.goto("/learn/what-is-dash");
  await passWhatIsDashQuiz(page);
  const toasts = page.locator("[data-sonner-toaster]");
  await toasts.getByRole("button", { name: "Save progress" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create a passkey" }).click();
  await expect(
    page.locator("header").getByRole("button", {
      name: "Open passkey profile. Progress saves automatically.",
    }),
  ).toBeVisible();

  // Drop the stored record while the session cookie survives. saveProgress then has neither an
  // existing document nor a public key to create one with, which is the real "failed" path.
  const saved = await readFile(STORE, "utf8");
  await writeFile(STORE, JSON.stringify({ records: {} }));

  await page.reload();
  await expect(toasts.getByText("Couldn't save progress")).toBeVisible();

  await writeFile(STORE, saved);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(toasts.getByText("Progress saved", { exact: true })).toBeVisible();
});
