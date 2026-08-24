import type { BrowserContext, Page } from "@playwright/test";

/** Correct option for each question in the what-is-dash quiz, in order. */
const WHAT_IS_DASH_ANSWERS: [question: string, option: string][] = [
  ["what-a-blockchain-is", "b"],
  ["give-an-address", "b"],
  ["no-double-spend", "c"],
  ["why-decentralize", "a"],
  ["masternode-enables", "b"],
  ["which-layer-data", "a"],
];

/** A discoverable platform authenticator that approves every prompt. */
export async function addVirtualAuthenticator(context: BrowserContext, page: Page) {
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
}

/** Answers the what-is-dash quiz correctly, leaving the page on the results card. */
export async function passWhatIsDashQuiz(page: Page) {
  for (const [index, [question, option]] of WHAT_IS_DASH_ANSWERS.entries()) {
    await page.locator(`input[name="${question}"][value="${option}"]`).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    const last = index === WHAT_IS_DASH_ANSWERS.length - 1;
    await page.getByRole("button", { name: last ? "See results" : "Next question" }).click();
  }
}
