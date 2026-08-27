import type { BrowserContext, Page } from "@playwright/test";

/** Correct option for each question in the what-is-a-blockchain quiz, in order. */
const FIRST_LESSON_ANSWERS: [question: string, option: string][] = [
  ["what-a-blockchain-is", "b"],
  ["no-double-spend", "a"],
  ["give-an-address", "c"],
  ["why-decentralize", "b"],
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

/** Answers the first lesson's quiz correctly, leaving the page on the results card. */
export async function passFirstLessonQuiz(page: Page) {
  for (const [index, [question, option]] of FIRST_LESSON_ANSWERS.entries()) {
    await page.locator(`input[name="${question}"][value="${option}"]`).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    const last = index === FIRST_LESSON_ANSWERS.length - 1;
    await page.getByRole("button", { name: last ? "See results" : "Next question" }).click();
  }
}
