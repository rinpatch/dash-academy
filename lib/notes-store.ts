import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";

export type Note = {
  id: string;
  text: string;
  createdAt: string;
};

export const NOTES_STORAGE_KEY = "dash-academy.notes.v1";

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
      // Notes remain available in memory when persistence is blocked.
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

export type NotesStore = {
  notesByLesson: Record<string, Note[]>;
  hasHydrated: boolean;
  addNote(lessonSlug: string, text: string): void;
  removeNote(lessonSlug: string, noteId: string): void;
  setHasHydrated(hasHydrated: boolean): void;
};

export function createNotesStore() {
  return createStore<NotesStore>()(
    persist(
      (set) => ({
        notesByLesson: {},
        hasHydrated: false,
        addNote: (lessonSlug, text) =>
          set((state) => ({
            notesByLesson: {
              ...state.notesByLesson,
              [lessonSlug]: [
                { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
                ...(state.notesByLesson[lessonSlug] ?? []),
              ],
            },
          })),
        removeNote: (lessonSlug, noteId) =>
          set((state) => ({
            notesByLesson: {
              ...state.notesByLesson,
              [lessonSlug]: (state.notesByLesson[lessonSlug] ?? []).filter((note) => note.id !== noteId),
            },
          })),
        setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      }),
      {
        name: NOTES_STORAGE_KEY,
        storage: createJSONStorage(() => safeBrowserStorage),
        skipHydration: true,
        partialize: (state) => ({ notesByLesson: state.notesByLesson }),
        onRehydrateStorage: (state) => () => {
          if (!state.hasHydrated) state.setHasHydrated(true);
        },
      },
    ),
  );
}

export type NotesStoreApi = ReturnType<typeof createNotesStore>;
