"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { ChallengeId } from "@/lib/progress";
import * as sync from "@/lib/progress/sync";
import { SyncError, type SyncFailure } from "@/lib/progress/sync";
import { passkeySupport } from "@/lib/passkey";
import { useCompletedChallenges, useProgressStore } from "@/components/providers/progress-provider";
import { SaveProgressDialog } from "@/components/site/save-progress-dialog";

type SyncStatus =
  | "checking"
  | "unsupported"
  | "anonymous"
  | "busy"
  | "conflict"
  | "signed-in"
  | "error";

export type ProgressConflict = {
  local: ChallengeId[];
  remote: ChallengeId[];
};

const SAVE_OFFER_SHOWN_KEY = "dash-academy.save-offer-shown";

type SyncContextValue = {
  status: SyncStatus;
  /** Why the last attempt failed, when status is "error". */
  failure: SyncFailure | null;
  conflict: ProgressConflict | null;
  promptOpen: boolean;
  openPrompt: () => void;
  dismissPrompt: () => void;
  enable: () => Promise<void>;
  restore: () => Promise<void>;
  chooseLocal: () => Promise<void>;
  choosePasskey: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

function fingerprint(ids: Iterable<ChallengeId>): string {
  return [...new Set(ids)].sort().join(",");
}

function rootCause(error: unknown): unknown {
  let cause = error;
  const seen = new Set<unknown>();
  while (cause instanceof Error && cause.cause && !seen.has(cause.cause)) {
    seen.add(cause);
    cause = cause.cause;
  }
  return cause;
}

/** Session-scoped so progress completion produces at most one unsolicited save offer. */
function readOfferShown(): boolean {
  try {
    return window.sessionStorage.getItem(SAVE_OFFER_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOfferShown() {
  try {
    window.sessionStorage.setItem(SAVE_OFFER_SHOWN_KEY, "1");
  } catch {
    // Repeating the offer next visit is better than crashing when storage is unavailable.
  }
}

/**
 * Mirrors local progress to Platform for learners who have opted in.
 *
 * Wraps, rather than replaces, the local store. Nothing here gates rendering or blocks a
 * lesson: if any of it fails the learner keeps the localStorage-backed experience.
 */
export function ProgressSyncProvider({ children }: { children: ReactNode }) {
  const store = useProgressStore();
  const { completedChallenges, syncedChallenges, isHydrated } = useCompletedChallenges();
  const mergeSynced = useStore(store, (state) => state.mergeSyncedChallenges);
  const replaceWithSynced = useStore(store, (state) => state.replaceWithSyncedChallenges);
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [failure, setFailure] = useState<SyncFailure | null>(null);
  const [conflict, setConflict] = useState<ProgressConflict | null>(null);
  const offerShown = useRef(
    typeof window !== "undefined" && readOfferShown(),
  );
  const pendingOffer = useRef(false);
  const seenCompletionCount = useRef<number | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pushNonce, setPushNonce] = useState(0);
  // The empty completion set fingerprints to "", so null is the only safe unsent sentinel.
  const lastPushed = useRef<string | null>(null);

  const localIds = useCallback(
    () => [...new Set([...(Object.keys(completedChallenges) as ChallengeId[]), ...syncedChallenges])],
    [completedChallenges, syncedChallenges],
  );

  // Resume an existing session, if this browser has one. Deferred because WebAuthn support and
  // the session cookie are client-only concerns.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [support, session] = await Promise.all([passkeySupport(), sync.status()]);
      if (cancelled) return;
      if (support === "unsupported" || session === "unavailable") {
        setStatus("unsupported");
        return;
      }
      if (session === "anonymous") {
        setStatus("anonymous");
        return;
      }
      const remote = await sync.pull();
      if (cancelled) return;
      if (remote) mergeSynced(remote);
      setStatus("signed-in");
    })().catch(() => !cancelled && setStatus("anonymous"));
    return () => {
      cancelled = true;
    };
  }, [mergeSynced]);

  // Once reconciliation has picked a source, later completions merge in automatically.
  useEffect(() => {
    if (status !== "signed-in" || !isHydrated) return;
    const ids = localIds();
    if (ids.length === 0) return;
    const nextFingerprint = fingerprint(ids);
    if (nextFingerprint === lastPushed.current) return;
    lastPushed.current = nextFingerprint;
    void sync
      .push(ids)
      .then((merged) => {
        if (!merged) throw new Error("push rejected");
        mergeSynced(merged);
        toast.success("Progress saved");
      })
      .catch(() => {
        lastPushed.current = null;
        toast.error("Couldn't save progress", {
          action: { label: "Retry", onClick: () => setPushNonce((nonce) => nonce + 1) },
        });
      });
  }, [status, isHydrated, localIds, mergeSynced, pushNonce]);

  const openPrompt = useCallback(() => {
    setFailure(null);
    setPromptOpen(true);
  }, []);

  // An anonymous completion gets a lightweight offer. The modal still requires an explicit
  // action, which keeps the passkey ceremony tied to a real click.
  const completionCount = isHydrated ? localIds().length : null;
  useEffect(() => {
    if (completionCount === null) return;
    const previous = seenCompletionCount.current;
    seenCompletionCount.current = completionCount;
    if (previous !== null && completionCount > previous) pendingOffer.current = true;

    if (status === "signed-in") {
      pendingOffer.current = false;
      return;
    }
    if (
      !pendingOffer.current ||
      offerShown.current ||
      (status !== "anonymous" && status !== "error")
    ) {
      return;
    }

    pendingOffer.current = false;
    offerShown.current = true;
    writeOfferShown();
    toast("Keep your progress", {
      description: "Save it across devices with a passkey.",
      action: { label: "Save progress", onClick: openPrompt },
    });
  }, [completionCount, openPrompt, status]);

  const dismissPrompt = useCallback(() => {
    if (conflict) {
      void sync.signOut();
      setConflict(null);
      setStatus("anonymous");
    }
    setPromptOpen(false);
  }, [conflict]);

  const fail = useCallback((error: unknown, nextStatus: SyncStatus = "error") => {
    // Expected product states belong in the dialog. Unexpected failures still need their
    // original cause in development, or every broken layer looks like the same generic error.
    const unexpected =
      !(error instanceof SyncError) ||
      error.reason === "failed" ||
      error.reason === "passkey-failed";
    if (unexpected) {
      console.error("progress sync failed", rootCause(error));
    }
    const reason = error instanceof SyncError ? error.reason : "failed";
    setFailure(reason);
    setStatus(nextStatus);
  }, []);

  const finish = useCallback(
    (ids: ChallengeId[], replaceLocal: boolean, notice: string) => {
      if (replaceLocal) replaceWithSynced(ids);
      else mergeSynced(ids);
      lastPushed.current = fingerprint(ids);
      setConflict(null);
      setFailure(null);
      setStatus("signed-in");
      setPromptOpen(false);
      toast.success(notice);
    },
    [mergeSynced, replaceWithSynced],
  );

  const enable = useCallback(async () => {
    setStatus("busy");
    setFailure(null);
    try {
      const saved = await sync.register(localIds());
      finish(saved, false, "Progress saved to Dash Platform");
    } catch (error) {
      fail(error);
    }
  }, [fail, finish, localIds]);

  const restore = useCallback(async () => {
    setStatus("busy");
    setFailure(null);
    const local = localIds();
    try {
      const remote = await sync.restore();
      const localFingerprint = fingerprint(local);
      const remoteFingerprint = fingerprint(remote);

      if (local.length > 0 && remote.length > 0 && localFingerprint !== remoteFingerprint) {
        setConflict({ local, remote });
        setStatus("conflict");
        return;
      }
      if (local.length > 0 && remote.length === 0) {
        const saved = await sync.replace(local);
        finish(saved, false, "Signed in and saved this device's progress");
        return;
      }
      if (local.length === 0 && remote.length > 0) {
        finish(remote, true, "Signed in and restored your progress");
        return;
      }

      finish(remote, false, "Signed in with your passkey");
    } catch (error) {
      fail(error);
    }
  }, [fail, finish, localIds]);

  const chooseLocal = useCallback(async () => {
    if (!conflict) return;
    setStatus("busy");
    setFailure(null);
    try {
      const saved = await sync.replace(conflict.local);
      finish(saved, false, "This device's progress is now saved");
    } catch (error) {
      fail(error, "conflict");
    }
  }, [conflict, fail, finish]);

  const choosePasskey = useCallback(async () => {
    if (!conflict) return;
    finish(conflict.remote, true, "Passkey progress restored to this device");
  }, [conflict, finish]);

  const handleSignOut = useCallback(async () => {
    await sync.signOut();
    lastPushed.current = null;
    setConflict(null);
    setFailure(null);
    setPromptOpen(false);
    setStatus("anonymous");
  }, []);

  return (
    <SyncContext.Provider
      value={{
        status,
        failure,
        conflict,
        promptOpen,
        openPrompt,
        dismissPrompt,
        enable,
        restore,
        chooseLocal,
        choosePasskey,
        signOut: handleSignOut,
      }}
    >
      {children}
      <SaveProgressDialog />
    </SyncContext.Provider>
  );
}

export function useProgressSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useProgressSync must be used within ProgressSyncProvider");
  return value;
}
