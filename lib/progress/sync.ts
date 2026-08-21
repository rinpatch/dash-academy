"use client";

import type { ChallengeId } from "@/lib/progress";
import { authenticatePasskey, createPasskey, PasskeyError } from "@/lib/passkey";
import {
  authenticate,
  authenticationOptions,
  getSessionState,
  pullProgress,
  pushProgress,
  register as registerAction,
  registrationOptions,
  signOut as signOutAction,
  type SessionState,
  type SyncResult,
} from "@/app/actions/progress";

/**
 * Client half of progress sync. Every call can fail quietly: localStorage is the source of
 * truth, and the course has to work with none of this available.
 *
 * The ceremonies have to run here — WebAuthn is a browser API — but the server issues every
 * challenge and verifies every response, so nothing here is trusted.
 */

export type { SessionState };

export type SyncFailure =
  | "cancelled"
  | "no-record"
  | "rejected"
  | "unavailable"
  | "unauthenticated"
  | "failed";

export class SyncError extends Error {
  constructor(readonly reason: SyncFailure) {
    super(reason);
  }
}

function completedOf(result: SyncResult): ChallengeId[] {
  if (result.status !== "ok") throw new SyncError(result.status);
  return result.completed;
}

/** Runs a ceremony, translating its failure into the same vocabulary the server uses. */
async function ceremony<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new SyncError(error instanceof PasskeyError ? error.reason : "failed");
  }
}

export function status(): Promise<SessionState> {
  return getSessionState();
}

/** Creates a passkey and stores current progress under it. */
export async function register(completed: ChallengeId[]): Promise<ChallengeId[]> {
  const options = await registrationOptions();
  if (!options) throw new SyncError("unavailable");
  const response = await ceremony(() => createPasskey(options));
  return completedOf(await registerAction(response, completed));
}

/** Restores progress saved under an existing passkey. */
export async function restore(completed: ChallengeId[]): Promise<ChallengeId[]> {
  const options = await authenticationOptions();
  if (!options) throw new SyncError("unavailable");
  const response = await ceremony(() => authenticatePasskey(options));
  return completedOf(await authenticate(response, completed));
}

/** Pulls stored progress for an already-open session. */
export async function pull(): Promise<ChallengeId[] | null> {
  const result = await pullProgress();
  return result.status === "ok" ? result.completed : null;
}

/** Pushes local progress. Returns the merged set, or null if not signed in. */
export async function push(completed: ChallengeId[]): Promise<ChallengeId[] | null> {
  const result = await pushProgress(completed);
  return result.status === "ok" ? result.completed : null;
}

export function signOut(): Promise<void> {
  return signOutAction();
}
