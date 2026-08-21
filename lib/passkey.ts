"use client";

/**
 * Turns a passkey into a stable key, using the WebAuthn PRF extension. Same key on every
 * device the passkey syncs to.
 *
 * We never verify assertions — only the real passkey can produce the PRF output, so having
 * it is the proof. That makes the key a bearer token: anyone who gets it can read and write
 * that learner's progress. Fine for course progress, don't reuse it for anything else.
 *
 * The PRF output stays in the browser. Only its hash is sent.
 */

/** Same input every time, so the same passkey always derives the same key. */
const PRF_CONTEXT = new TextEncoder().encode("dash-academy/progress/v1");

export type PasskeySupport = "supported" | "unsupported";

export async function passkeySupport(): Promise<PasskeySupport> {
  if (typeof window === "undefined" || typeof window.PublicKeyCredential !== "function") {
    return "unsupported";
  }
  // Without a platform authenticator, PRF prompts and then fails. Better not to offer it.
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
    () => false,
  );
  return available ? "supported" : "unsupported";
}

async function digestToHex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function prfResult(credential: PublicKeyCredential): ArrayBuffer | null {
  const results = credential.getClientExtensionResults().prf?.results;
  return (results?.first as ArrayBuffer | undefined) ?? null;
}

const PRF_EVAL = { eval: { first: PRF_CONTEXT } } as const;

/**
 * Creates a passkey and returns the derived key, or null if the authenticator can't do PRF.
 *
 * Many authenticators say PRF is enabled at creation but only hand over the value during an
 * assertion, hence the get() fallback.
 */
export async function createPasskey(): Promise<string | null> {
  const userId = crypto.getRandomValues(new Uint8Array(32));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      // No rp.id: it defaults to the current domain, and since the server verifies nothing
      // there's no relying-party config to keep in sync with the deployment.
      rp: { name: "Dash Academy" },
      // No email, no username, no password — the passkey is the whole account.
      user: { id: userId, name: "Dash Academy learner", displayName: "Dash Academy learner" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        // Discoverable, so a new device can restore without us asking who they are. There's
        // no user table to look them up in.
        residentKey: "required",
        userVerification: "required",
      },
      extensions: { prf: PRF_EVAL },
    },
  })) as PublicKeyCredential | null;

  if (!credential) return null;
  if (credential.getClientExtensionResults().prf?.enabled === false) return null;

  const direct = prfResult(credential);
  if (direct) return digestToHex(direct);
  return authenticatePasskey();
}

/** Reads the derived key from an existing passkey. Returns null if unusable. */
export async function authenticatePasskey(): Promise<string | null> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      userVerification: "required",
      // No allowCredentials — the browser finds the discoverable credential itself.
      extensions: { prf: PRF_EVAL },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) return null;
  const result = prfResult(assertion);
  return result ? digestToHex(result) : null;
}
