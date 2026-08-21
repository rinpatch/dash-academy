import { expect, test } from "@playwright/test";

test("saves and restores progress with a discoverable passkey", async ({ context, page }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable", { enableUI: false });
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      ctap2Version: "ctap2_1",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto("/learn/what-is-dash");
  const header = page.locator("header");
  const save = header.getByRole("button", { name: "Save progress" });
  await expect(save).toBeVisible();

  await page.evaluate(() => {
    const key = "dash-academy.progress.v2";
    const progress = JSON.parse(localStorage.getItem(key) ?? '{"state":{}}');
    progress.state ??= {};
    progress.state.completedChallenges = {
      "what-is-dash": {
        completedAt: new Date().toISOString(),
        evidence: { score: 1, total: 1, answers: {} },
      },
    };
    progress.version = 2;
    localStorage.setItem(key, JSON.stringify(progress));
  });
  await page.reload();

  await header.getByRole("button", { name: "Save progress" }).click();
  await expect(header.getByText("Progress saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(header.getByText("Progress saved", { exact: true })).toBeVisible();

  // Keep the virtual authenticator but remove this browser's local session and progress.
  await page.evaluate(() => localStorage.clear());
  await context.clearCookies();
  await page.reload();
  await expect(header.getByRole("button", { name: "Save progress" })).toBeVisible();

  await header.getByRole("button", { name: "Restore progress with a passkey" }).click();
  await expect(header.getByText("Progress saved", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const progress = JSON.parse(localStorage.getItem("dash-academy.progress.v2") ?? "{}");
        return progress?.state?.syncedChallenges ?? [];
      }),
    )
    .toContain("what-is-dash");
});
