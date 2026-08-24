import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers";

// Kept in step with DASH_ACADEMY_E2E_STORE in playwright.config.ts.
const STORE = path.resolve("test-results/e2e-store/progress.json");

async function onlyRecord() {
  const store = JSON.parse(await readFile(STORE, "utf8"));
  const records = Object.values(store.records) as { revision: string; completed: string[] }[];
  return records[records.length - 1];
}

async function openPasskeyDialog(page: Page) {
  await page.locator("header").getByRole("button", { name: "Open passkey profile" }).click();
  return page.getByRole("dialog");
}

async function expectSignedIn(page: Page) {
  await expect(
    page.locator("header").getByRole("button", {
      name: "Open passkey profile. Progress saves automatically.",
    }),
  ).toBeVisible();
}

test("an unexpected authenticator failure keeps its cause", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.credentials, "create", {
      configurable: true,
      value: async () => {
        throw new Error("synthetic authenticator failure");
      },
    });
  });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/learn/what-is-dash");
  const dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Create a passkey" }).click();

  await expect(
    dialog.getByText("Your authenticator couldn't complete the passkey request."),
  ).toBeVisible();
  expect(consoleErrors.some((message) => message.includes("synthetic authenticator failure"))).toBe(
    true,
  );
});

test("saves and restores progress with a discoverable passkey", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);

  // Seed a completion before hydration; existing progress must not trigger an unsolicited offer.
  await page.addInitScript(() => {
    localStorage.setItem(
      "dash-academy.progress.v2",
      JSON.stringify({
        version: 2,
        state: {
          completedChallenges: {
            "what-is-dash": {
              completedAt: new Date().toISOString(),
              evidence: { score: 1, total: 1, answers: {} },
            },
          },
        },
      }),
    );
  });

  await page.goto("/learn/what-is-dash");
  const header = page.locator("header");

  await openPasskeyDialog(page);
  await page.getByRole("button", { name: "Create a passkey" }).click();
  await expectSignedIn(page);

  await page.reload();
  await expectSignedIn(page);

  // Keep the virtual authenticator but remove this browser's local session and progress.
  await context.clearCookies();
  await page.addInitScript(() => localStorage.removeItem("dash-academy.progress.v2"));
  await page.reload();
  await expect(
    header.getByRole("button", { name: "Open passkey profile", exact: true }),
  ).toBeVisible();

  // Signing in with nothing done locally must read the record, not pay to rewrite it.
  const before = await onlyRecord();
  const dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expectSignedIn(page);
  expect(await onlyRecord()).toEqual(before);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const progress = JSON.parse(localStorage.getItem("dash-academy.progress.v2") ?? "{}");
        return progress?.state?.syncedChallenges ?? [];
      }),
    )
    .toContain("what-is-dash");
});

test("signing in saves local progress when the passkey record is empty", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.goto("/learn/what-is-dash");

  let dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Create a passkey" }).click();
  await expectSignedIn(page);

  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign out on this device" }).click();
  await page.evaluate(() => {
    localStorage.setItem(
      "dash-academy.progress.v2",
      JSON.stringify({
        version: 2,
        state: {
          completedChallenges: {
            identities: {
              completedAt: new Date().toISOString(),
              evidence: { score: 1, total: 1, answers: {} },
            },
          },
          syncedChallenges: [],
        },
      }),
    );
  });
  await page.reload();

  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expectSignedIn(page);
  expect((await onlyRecord()).completed).toEqual(["identities"]);
});

test("asks which progress to keep when both sides have data", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  await page.goto("/learn/what-is-dash");
  await page.evaluate(() => {
    localStorage.setItem(
      "dash-academy.progress.v2",
      JSON.stringify({
        version: 2,
        state: {
          completedChallenges: {
            "what-is-dash": {
              completedAt: new Date().toISOString(),
              evidence: { score: 1, total: 1, answers: {} },
            },
          },
          syncedChallenges: [],
        },
      }),
    );
  });
  await page.reload();

  let dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Create a passkey" }).click();
  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign out on this device" }).click();

  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("dash-academy.progress.v2") ?? "{}");
    progress.state.completedChallenges = {
      identities: {
        completedAt: new Date().toISOString(),
        evidence: { score: 1, total: 1, answers: {} },
      },
    };
    progress.state.syncedChallenges = [];
    localStorage.setItem("dash-academy.progress.v2", JSON.stringify(progress));
  });
  await page.reload();

  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(dialog.getByText("Which progress should we keep?")).toBeVisible();
  await dialog.getByRole("button", { name: "Use this device" }).click();

  await expectSignedIn(page);
  expect((await onlyRecord()).completed).toEqual(["identities"]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const progress = JSON.parse(localStorage.getItem("dash-academy.progress.v2") ?? "{}");
        return {
          local: Object.keys(progress?.state?.completedChallenges ?? {}),
          synced: progress?.state?.syncedChallenges ?? [],
        };
      }),
    )
    .toEqual({ local: ["identities"], synced: ["identities"] });
});

test("an unlinked passkey explains how to recover without a console error", async ({ context, page }) => {
  await addVirtualAuthenticator(context, page);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/learn/what-is-dash");
  await page.evaluate(() => {
    localStorage.setItem(
      "dash-academy.progress.v2",
      JSON.stringify({
        version: 2,
        state: {
          completedChallenges: {
            identities: {
              completedAt: new Date().toISOString(),
              evidence: { score: 1, total: 1, answers: {} },
            },
          },
          syncedChallenges: [],
        },
      }),
    );
  });
  await page.reload();

  let dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Create a passkey" }).click();
  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign out on this device" }).click();

  // The authenticator still has the passkey, but its verification record is gone.
  await writeFile(STORE, JSON.stringify({ records: {} }));
  dialog = await openPasskeyDialog(page);
  await dialog.getByRole("button", { name: "Sign in with a passkey" }).click();

  await expect(
    dialog.getByText("This passkey exists, but its Dash Academy profile is missing."),
  ).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes("no-record"))).toEqual([]);

  const notNow = await dialog.getByRole("button", { name: "Not now" }).boundingBox();
  const signIn = await dialog.getByRole("button", { name: "Sign in with a passkey" }).boundingBox();
  const create = await dialog.getByRole("button", { name: "Create new passkey" }).boundingBox();

  expect(notNow).not.toBeNull();
  expect(signIn).not.toBeNull();
  expect(create).not.toBeNull();
  expect(notNow!.x).toBeLessThan(signIn!.x);
  expect(Math.abs(notNow!.y - signIn!.y)).toBeLessThan(2);
  expect(Math.abs(signIn!.y - create!.y)).toBeLessThan(2);

  await dialog.getByRole("button", { name: "Create new passkey" }).click();
  await expectSignedIn(page);
  expect((await onlyRecord()).completed).toEqual(["identities"]);
});
