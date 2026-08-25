"use server";

import { createHmac } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { ChallengeId } from "@/lib/progress";
import { parseCompletedChallengeIds } from "@/lib/progress/payload";
import {
  consumeChallenge,
  endSession,
  newChallenge,
  readSession,
  rememberChallenge,
  startSession,
} from "@/app/lib/session";
import { getPlatformConfig } from "@/app/lib/platform-config";
import { CEREMONY, getWebAuthnConfig } from "@/app/lib/webauthn";
import { fetchProgress, saveProgress } from "@/app/lib/progress-repository";

/**
 * Progress sync, called directly from the client. Private to this app, so there is no HTTP
 * boundary and no hand-written JSON on either side.
 */

export type SessionState = "unavailable" | "anonymous" | "signed-in";

export type SyncResult =
  | { status: "ok"; completed: ChallengeId[] }
  | { status: "unavailable" }
  | { status: "unauthenticated" }
  | { status: "no-record" }
  | { status: "rejected" }
  | { status: "failed" };

/**
 * The learner's record locator. HMAC'd before it becomes document entropy, so a public
 * document id cannot be used to test candidate WebAuthn credential ids.
 */
function recordKey(credentialId: string, salt: string): Buffer {
  return createHmac("sha256", salt).update(credentialId).digest();
}

function ready() {
  const platform = getPlatformConfig();
  const webauthn = getWebAuthnConfig();
  return platform && webauthn && process.env.DASH_SESSION_SECRET ? { platform, webauthn } : null;
}

function failed(operation: string, error: unknown): SyncResult {
  console.error(`progress sync ${operation} failed`, error);
  return { status: "failed" };
}

export async function getSessionState(): Promise<SessionState> {
  if (!ready()) return "unavailable";
  return (await readSession()) ? "signed-in" : "anonymous";
}

export async function registrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON | null> {
  const config = ready();
  if (!config) return null;
  const options = await generateRegistrationOptions({
    rpID: config.webauthn.rpId,
    rpName: config.webauthn.rpName,
    // Anonymous by design: no email, no username. The credential is the account, so the
    // label only has to be unique-ish for the authenticator's own list.
    userName: `learner-${Date.now().toString(36)}`,
    challenge: newChallenge(),
    ...CEREMONY,
    supportedAlgorithmIDs: [...CEREMONY.supportedAlgorithmIDs],
  });
  await rememberChallenge(options.challenge);
  return options;
}

export async function authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON | null> {
  const config = ready();
  if (!config) return null;
  const options = await generateAuthenticationOptions({
    rpID: config.webauthn.rpId,
    challenge: newChallenge(),
    // No allowCredentials: with no user table the server can't name the credential, so the
    // browser discovers it. That's why registration insists on a resident key.
    userVerification: "preferred",
  });
  await rememberChallenge(options.challenge);
  return options;
}

/** Verifies a registration and stores current progress under the new credential. */
export async function register(
  response: RegistrationResponseJSON,
  completed: ChallengeId[],
): Promise<SyncResult> {
  const config = ready();
  if (!config) return { status: "unavailable" };
  const expectedChallenge = await consumeChallenge();
  if (!expectedChallenge) return { status: "rejected" };

  let credential;
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
    });
    if (!verification.verified || !verification.registrationInfo) return { status: "rejected" };
    credential = verification.registrationInfo.credential;
  } catch {
    return { status: "rejected" };
  }

  // Whatever was done as a guest comes along; opting in saves rather than resets.
  const local = parseCompletedChallengeIds(completed);
  const key = recordKey(credential.id, config.platform.learnerKeySalt);

  try {
    const stored = await saveProgress(key, local, credential.publicKey);
    await startSession(key.toString("hex"));
    return { status: "ok", completed: [...(stored?.completed ?? local)] };
  } catch (error) {
    return failed("registration write", error);
  }
}

/**
 * Verifies an assertion and opens a session on the record it belongs to.
 *
 * The assertion names its own credential, which is what makes the record findable without a
 * database: credential id -> learner key -> document -> the key to verify against.
 */
export async function authenticate(
  response: AuthenticationResponseJSON,
): Promise<SyncResult> {
  const config = ready();
  if (!config) return { status: "unavailable" };
  const expectedChallenge = await consumeChallenge();
  if (!expectedChallenge) return { status: "rejected" };

  const key = recordKey(response.id, config.platform.learnerKeySalt);
  let stored;
  try {
    stored = await fetchProgress(key);
  } catch (error) {
    // A network or Platform failure is retryable; reporting it as a missing credential would
    // send the learner down the wrong recovery path.
    return failed("authentication read", error);
  }
  if (!stored?.credentialPublicKey.length) return { status: "no-record" };

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      credential: {
        id: response.id,
        publicKey: new Uint8Array(stored.credentialPublicKey),
        // Synced passkeys don't maintain a signature counter, so there is nothing to compare
        // against and no clone detection to be had here.
        counter: 0,
      },
    });
    if (!verification.verified) return { status: "rejected" };
  } catch {
    return { status: "rejected" };
  }

  try {
    await startSession(key.toString("hex"));
    return { status: "ok", completed: [...stored.completed] };
  } catch (error) {
    return failed("session start", error);
  }
}

/** Replaces the signed-in record after the learner chooses this device in a conflict. */
export async function replaceProgress(completed: ChallengeId[]): Promise<SyncResult> {
  if (!ready()) return { status: "unavailable" };
  const learnerKeyHex = await readSession();
  if (!learnerKeyHex) return { status: "unauthenticated" };

  const local = parseCompletedChallengeIds(completed);
  try {
    const stored = await saveProgress(
      Buffer.from(learnerKeyHex, "hex"),
      local,
      undefined,
      "replace",
    );
    return { status: "ok", completed: [...(stored?.completed ?? local)] };
  } catch (error) {
    return failed("progress replace", error);
  }
}

export async function pullProgress(): Promise<SyncResult> {
  if (!ready()) return { status: "unavailable" };
  const learnerKeyHex = await readSession();
  if (!learnerKeyHex) return { status: "unauthenticated" };

  try {
    const stored = await fetchProgress(Buffer.from(learnerKeyHex, "hex"));
    return { status: "ok", completed: stored ? [...stored.completed] : [] };
  } catch (error) {
    return failed("progress pull", error);
  }
}

export async function pushProgress(completed: ChallengeId[]): Promise<SyncResult> {
  if (!ready()) return { status: "unavailable" };
  const learnerKeyHex = await readSession();
  if (!learnerKeyHex) return { status: "unauthenticated" };

  const local = parseCompletedChallengeIds(completed);
  try {
    // Unions with what is stored, so a stale tab can't roll anyone back.
    const stored = await saveProgress(Buffer.from(learnerKeyHex, "hex"), local);
    return { status: "ok", completed: [...(stored?.completed ?? local)] };
  } catch (error) {
    return failed("progress push", error);
  }
}

export async function signOut(): Promise<void> {
  await endSession();
}
