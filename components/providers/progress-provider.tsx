"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "zustand";
import { ChallengeEvidenceMap, ChallengeId, getCompletedLessonIds } from "@/lib/progress";
import {
  createProgressStore,
  ProgressStoreApi,
  PROGRESS_STORAGE_KEY,
} from "@/lib/progress/store";

const ProgressStoreContext = createContext<ProgressStoreApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createProgressStore);

  useEffect(() => {
    void store.persist.rehydrate();

    function handleStorage(event: StorageEvent) {
      if (event.key === PROGRESS_STORAGE_KEY) void store.persist.rehydrate();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [store]);

  return (
    <ProgressStoreContext.Provider value={store}>{children}</ProgressStoreContext.Provider>
  );
}

export function useChallengeProgress<K extends ChallengeId>(challengeId: K) {
  const store = useContext(ProgressStoreContext);

  if (!store) {
    throw new Error("useChallengeProgress must be used within ProgressProvider");
  }

  const completion = useStore(store, (state) => state.completedChallenges[challengeId]);
  const isHydrated = useStore(store, (state) => state.hasHydrated);
  const completeChallenge = useStore(store, (state) => state.completeChallenge);
  const complete = useCallback(
    (evidence: ChallengeEvidenceMap[K]) => completeChallenge(challengeId, evidence),
    [challengeId, completeChallenge],
  );

  return {
    completion,
    isHydrated,
    complete,
  };
}

export function useCompletedChallenges() {
  const store = useProgressStore();

  return {
    completedChallenges: useStore(store, (state) => state.completedChallenges),
    syncedChallenges: useStore(store, (state) => state.syncedChallenges),
    isHydrated: useStore(store, (state) => state.hasHydrated),
  };
}

/**
 * Lessons the learner has finished, counting both locally evidenced completions and any
 * restored from Platform.
 */
export function useCompletedLessonIds(): { lessonIds: Set<string>; isHydrated: boolean } {
  const { completedChallenges, syncedChallenges, isHydrated } = useCompletedChallenges();
  const lessonIds = useMemo(
    () => (isHydrated ? getCompletedLessonIds(completedChallenges, syncedChallenges) : new Set<string>()),
    [completedChallenges, syncedChallenges, isHydrated],
  );
  return { lessonIds, isHydrated };
}

export function useProgressStore(): ProgressStoreApi {
  const store = useContext(ProgressStoreContext);
  if (!store) throw new Error("Progress hooks must be used within ProgressProvider");
  return store;
}
