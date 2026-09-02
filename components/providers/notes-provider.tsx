"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createNotesStore, NotesStore, NotesStoreApi } from "@/lib/notes-store";

const NotesStoreContext = createContext<NotesStoreApi | null>(null);

// The notes panel renders twice on a lesson page — once in the desktop sidebar, once in the
// mobile sheet. Per-instance stores would each persist over the other's writes, so they share
// one store from here.
export function NotesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createNotesStore);

  useEffect(() => void store.persist.rehydrate(), [store]);

  return <NotesStoreContext.Provider value={store}>{children}</NotesStoreContext.Provider>;
}

export function useNotesStore<T>(selector: (state: NotesStore) => T): T {
  const store = useContext(NotesStoreContext);

  if (!store) {
    throw new Error("useNotesStore must be used within NotesProvider");
  }

  return useStore(store, selector);
}
