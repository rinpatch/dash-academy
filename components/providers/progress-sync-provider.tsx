"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { ChallengeId } from "@/lib/progress";
import * as sync from "@/lib/progress/sync";
import { passkeySupport } from "@/lib/passkey";
import { useCompletedChallenges, useProgressStore } from "@/components/providers/progress-provider";

type SyncStatus = "checking" | "unsupported" | "anonymous" | "busy" | "signed-in" | "error";

type SyncContextValue = {
  status: SyncStatus;
  enable: () => Promise<void>;
  restore: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Mirrors local progress to Platform for learners who have opted in.
 *
 * Wraps, rather than replaces, the local store. Nothing here gates rendering or blocks a
 * lesson: if any of it fails the learner simply keeps the localStorage-backed experience
 * they had before opting in.
 */
export function ProgressSyncProvider({ children }: { children: ReactNode }) {
  const store = useProgressStore();
  const { completedChallenges, syncedChallenges, isHydrated } = useCompletedChallenges();
  const mergeSynced = useStore(store, (state) => state.mergeSyncedChallenges);
  const [status, setStatus] = useState<SyncStatus>("checking");
  const lastPushed = useRef<string>("");

  const localIds = useCallback(
    () => [...new Set([...(Object.keys(completedChallenges) as ChallengeId[]), ...syncedChallenges])],
    [completedChallenges, syncedChallenges],
  );

  // Resume an existing session, if this browser has one. Deferred to an effect because both
  // checks are client-only: the server cannot know whether this browser has a usable
  // authenticator, so deciding during render would mismatch on hydration.
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

  // Push on change, once signed in. Completion events are rare enough that a plain
  // fire-on-change is fine; the guard is only to avoid re-sending an identical set.
  useEffect(() => {
    if (status !== "signed-in" || !isHydrated) return;
    const ids = localIds();
    const fingerprint = [...ids].sort().join(",");
    if (fingerprint === lastPushed.current) return;
    lastPushed.current = fingerprint;
    void sync.push(ids).then((merged) => merged && mergeSynced(merged)).catch(() => undefined);
  }, [status, isHydrated, localIds, mergeSynced]);

  const enable = useCallback(async () => {
    setStatus("busy");
    try {
      const merged = await sync.register(localIds());
      if (!merged) throw new Error("registration failed");
      mergeSynced(merged);
      setStatus("signed-in");
    } catch {
      setStatus("error");
    }
  }, [localIds, mergeSynced]);

  const restore = useCallback(async () => {
    setStatus("busy");
    try {
      const merged = await sync.restore(localIds());
      if (!merged) throw new Error("authentication failed");
      mergeSynced(merged);
      setStatus("signed-in");
    } catch {
      setStatus("error");
    }
  }, [localIds, mergeSynced]);

  const handleSignOut = useCallback(async () => {
    await sync.signOut();
    lastPushed.current = "";
    setStatus("anonymous");
  }, []);

  return (
    <SyncContext.Provider value={{ status, enable, restore, signOut: handleSignOut }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useProgressSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useProgressSync must be used within ProgressSyncProvider");
  return value;
}
