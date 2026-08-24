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
export type PasskeyFailure =
  | "cancelled"
  | "credential-exists"
  | "misconfigured"
  | "unsupported-authenticator"
  | "failed";

export class PasskeyError extends Error {
  constructor(readonly reason: PasskeyFailure, cause?: unknown) {
    super(reason, { cause });
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
function passkeyFailure(error: unknown): PasskeyFailure {
  const { name, code } = (error as { name?: string; code?: string }) ?? {};
  if (code === "ERROR_INVALID_RP_ID" || code === "ERROR_INVALID_DOMAIN") {
    return "misconfigured";
  }
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "credential-exists";
  }
  if (
    code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT" ||
    code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" ||
    code === "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG"
  ) {
    return "unsupported-authenticator";
  }
  return name === "NotAllowedError" || name === "AbortError" ? "cancelled" : "failed";
}

function toPasskeyError(error: unknown): PasskeyError {
  return new PasskeyError(passkeyFailure(error), error);
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
