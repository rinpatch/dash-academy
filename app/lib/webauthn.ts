import "server-only";
import { z } from "zod";

/**
 * WebAuthn relying-party config.
 *
 * Passkeys must be discoverable: at sign-in the academy has no user table, so it can't tell
 * the browser which credential to use. The browser finds it and returns its id, which is
 * what locates the learner's record.
 */
const schema = z.object({
  rpId: z.string().min(1),
  rpName: z.string().min(1).default("Dash Academy"),
  origin: z.string().url(),
});

export type WebAuthnConfig = z.infer<typeof schema>;

export function getWebAuthnConfig(): WebAuthnConfig | null {
  const parsed = schema.safeParse({
    rpId: process.env.WEBAUTHN_RP_ID,
    rpName: process.env.WEBAUTHN_RP_NAME,
    origin: process.env.WEBAUTHN_ORIGIN,
  });
  return parsed.success ? parsed.data : null;
}

export const CEREMONY = {
  attestationType: "none",
  authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  // ES256 and RS256 — the two every platform authenticator supports.
  supportedAlgorithmIDs: [-7, -257],
} as const;
