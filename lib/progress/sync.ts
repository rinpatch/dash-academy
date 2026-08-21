"use client";

import type { ChallengeId } from "@/lib/progress";
import { authenticatePasskey, createPasskey } from "@/lib/passkey";
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

function completedOf(result: SyncResult): ChallengeId[] | null {
  return result.status === "ok" ? result.completed : null;
}

export function status(): Promise<SessionState> {
  return getSessionState();
}

/** Creates a passkey and stores current progress under it. */
export async function register(completed: ChallengeId[]): Promise<ChallengeId[] | null> {
  const clientKey = await createPasskey();
  if (!clientKey) return null;
  return completedOf(await openSession(clientKey, completed, true));
}

/** Restores progress saved under an existing passkey. */
export async function restore(completed: ChallengeId[]): Promise<ChallengeId[] | null> {
  const clientKey = await authenticatePasskey();
  if (!clientKey) return null;
  return completedOf(await openSession(clientKey, completed, false));
}

/** Pulls stored progress for an already-open session. */
export async function pull(): Promise<ChallengeId[] | null> {
  return completedOf(await pullProgress());
}

/** Pushes local progress. Returns the merged set, or null if not signed in. */
export async function push(completed: ChallengeId[]): Promise<ChallengeId[] | null> {
  return completedOf(await pushProgress(completed));
}

export function signOut(): Promise<void> {
  return signOutAction();
}
