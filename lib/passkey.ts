"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

/**
 * Passkey ceremonies. The browser half only collects a signed response — the server decides
 * whether it's valid.
 */

/** Why a ceremony produced nothing. */
export type PasskeyFailure = "cancelled" | "failed";

export class PasskeyError extends Error {
  constructor(readonly reason: PasskeyFailure) {
    super(reason);
  }
}

export type PasskeySupport = "supported" | "unsupported";

export async function passkeySupport(): Promise<PasskeySupport> {
  if (typeof window === "undefined" || typeof window.PublicKeyCredential !== "function") {
    return "unsupported";
  }
  // Without a platform authenticator the ceremony prompts and then fails.
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
    () => false,
  );
  return available ? "supported" : "unsupported";
}

/** A dismissed prompt is ordinary and shouldn't read as an error. */
function toPasskeyError(error: unknown): PasskeyError {
  const name = (error as { name?: string })?.name;
  return new PasskeyError(name === "NotAllowedError" || name === "AbortError" ? "cancelled" : "failed");
}

export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  try {
    return await startRegistration({ optionsJSON: options });
  } catch (error) {
    throw toPasskeyError(error);
  }
}

export async function authenticatePasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  try {
    return await startAuthentication({ optionsJSON: options });
  } catch (error) {
    throw toPasskeyError(error);
  }
}
