import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
import {
  ChallengeEvidenceMap,
  ChallengeId,
  CompletedChallenges,
  parseCompletedChallenges,
  withCompletedChallenge,
} from "@/lib/progress";

export const PROGRESS_STORAGE_KEY = "dash-academy.progress.v2";

const safeBrowserStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Progress remains available in memory when persistence is blocked.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Treat unavailable browser storage as already empty.
    }
  },
};

export type ProgressStore = {
  completedChallenges: CompletedChallenges;
  hasHydrated: boolean;
  completeChallenge<K extends ChallengeId>(
    challengeId: K,
    evidence: ChallengeEvidenceMap[K],
  ): void;
  setHasHydrated(hasHydrated: boolean): void;
};

export function createProgressStore() {
  return createStore<ProgressStore>()(
    persist(
      (set) => ({
        completedChallenges: {},
        hasHydrated: false,
        completeChallenge: (challengeId, evidence) =>
          set((state) => ({
            completedChallenges: withCompletedChallenge(
              state.completedChallenges,
              challengeId,
              evidence,
            ),
          })),
        setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      }),
      {
        name: PROGRESS_STORAGE_KEY,
        version: 2,
        storage: createJSONStorage(() => safeBrowserStorage),
        skipHydration: true,
        partialize: (state) => ({
          completedChallenges: state.completedChallenges,
        }),
        merge: (persisted, current) => {
          const stored = persisted as { completedChallenges?: unknown } | null;
          return {
            ...current,
            completedChallenges: parseCompletedChallenges(stored?.completedChallenges),
          };
        },
        onRehydrateStorage: (state) => () => {
          if (!state.hasHydrated) state.setHasHydrated(true);
        },
      },
    ),
  );
}

export type ProgressStoreApi = ReturnType<typeof createProgressStore>;
