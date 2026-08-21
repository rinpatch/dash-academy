"use client";

import type { ChallengeId } from "@/lib/progress";
import { authenticatePasskey, createPasskey, PasskeyError } from "@/lib/passkey";
import {
  getSessionState,
  openSession,
  pullProgress,
  pushProgress,
  signOut as signOutAction,
  type SessionState,
  type SyncResult,
} from "@/app/actions/progress";

/**
 * Client half of progress sync. Every call can fail quietly: localStorage is the source of
 * truth, and the course has to work with none of this available.
 *
 * The passkey work has to happen here — WebAuthn is a browser API — but everything after it
 * is a server action, so nothing is serialised by hand.
 */

export type { SessionState };

/** Why sync couldn't proceed, in words a person can act on. */
export type SyncFailure =
  | "no-prf"
  | "cancelled"
  | "no-record"
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

/** Turns a passkey ceremony failure into the same vocabulary as a server failure. */
async function derive(ceremony: () => Promise<string>): Promise<string> {
  try {
    return await ceremony();
  } catch (error) {
    throw new SyncError(error instanceof PasskeyError ? error.reason : "failed");
  }
}

export function status(): Promise<SessionState> {
  return getSessionState();
}

/** Creates a passkey and stores current progress under it. */
export async function register(completed: ChallengeId[]): Promise<ChallengeId[]> {
  const clientKey = await derive(createPasskey);
  return completedOf(await openSession(clientKey, completed, true));
}

/** Restores progress saved under an existing passkey. */
export async function restore(completed: ChallengeId[]): Promise<ChallengeId[]> {
  const clientKey = await derive(authenticatePasskey);
  return completedOf(await openSession(clientKey, completed, false));
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
