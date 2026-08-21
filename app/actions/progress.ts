"use server";

import { createHmac } from "node:crypto";
import type { ChallengeId } from "@/lib/progress";
import { parseCompletedChallengeIds } from "@/lib/progress/payload";
import { endSession, readSession, startSession } from "@/app/lib/session";
import { getPlatformConfig } from "@/app/lib/platform-config";
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
  | { status: "failed" };

const CLIENT_KEY = /^[0-9a-f]{64}$/;

/**
 * The learner's record locator. HMAC'd rather than used raw, so the identifier stored on a
 * public chain can't be reversed into the key that opens it.
 */
function recordKey(clientKey: string, salt: string): Buffer {
  return createHmac("sha256", salt).update(clientKey).digest();
}

function configured() {
  const config = getPlatformConfig();
  return config && process.env.DASH_SESSION_SECRET ? config : null;
}

export async function getSessionState(): Promise<SessionState> {
  if (!configured()) return "unavailable";
  return (await readSession()) ? "signed-in" : "anonymous";
}

/**
 * Opens a session from a passkey-derived key. Nothing is verified: only the learner's own
 * passkey can produce that key, so holding it is the proof. See lib/passkey.ts for the
 * limits of that.
 *
 * `create` false means "restore an existing record". If none is found, that's almost always
 * the wrong passkey, so it fails rather than silently starting a second empty record.
 */
export async function openSession(
  clientKey: string,
  completed: ChallengeId[],
  create: boolean,
): Promise<SyncResult> {
  const config = configured();
  if (!config) return { status: "unavailable" };
  if (!CLIENT_KEY.test(clientKey)) return { status: "failed" };

  const key = recordKey(clientKey, config.learnerKeySalt);
  const existing = await fetchProgress(key).catch(() => null);
  if (!existing && !create) return { status: "no-record" };

  // Whatever was done as a guest comes along; opting in saves rather than resets.
  const local = parseCompletedChallengeIds(completed);

  try {
    const stored = await saveProgress(key, local);
    await startSession(key.toString("hex"));
    return { status: "ok", completed: [...(stored?.completed ?? local)] };
  } catch {
    return { status: "failed" };
  }
}

export async function pullProgress(): Promise<SyncResult> {
  if (!configured()) return { status: "unavailable" };
  const learnerKeyHex = await readSession();
  if (!learnerKeyHex) return { status: "unauthenticated" };

  const stored = await fetchProgress(Buffer.from(learnerKeyHex, "hex")).catch(() => null);
  return { status: "ok", completed: stored ? [...stored.completed] : [] };
}

export async function pushProgress(completed: ChallengeId[]): Promise<SyncResult> {
  if (!configured()) return { status: "unavailable" };
  const learnerKeyHex = await readSession();
  if (!learnerKeyHex) return { status: "unauthenticated" };

  const local = parseCompletedChallengeIds(completed);
  try {
    // Unions with what is stored, so a stale tab can't roll anyone back.
    const stored = await saveProgress(Buffer.from(learnerKeyHex, "hex"), local);
    return { status: "ok", completed: [...(stored?.completed ?? local)] };
  } catch {
    return { status: "failed" };
  }
}

export async function signOut(): Promise<void> {
  await endSession();
}
