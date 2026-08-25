"use client";

import { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createNotesStore, type Note } from "@/lib/notes-store";

const EMPTY_NOTES: Note[] = [];

export function NotesPanel({ lessonSlug, lessonTitle }: { lessonSlug: string; lessonTitle: string }) {
  const [store] = useState(createNotesStore);
  useEffect(() => void store.persist.rehydrate(), [store]);

  const notes = useStore(store, (state) => state.notesByLesson[lessonSlug] ?? EMPTY_NOTES);
  const isHydrated = useStore(store, (state) => state.hasHydrated);
  const addNote = useStore(store, (state) => state.addNote);
  const removeNote = useStore(store, (state) => state.removeNote);
  const [draft, setDraft] = useState("");

  function saveDraft() {
    const text = draft.trim();
    if (!text) return;
    addNote(lessonSlug, text);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-1">
          <p className="text-xl font-extrabold">Notes</p>
          <p className="text-sm font-medium text-foreground/48">Your notes save automatically.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-background p-4">
          <label htmlFor="lesson-note" className="sr-only">
            Note about {lessonTitle}
          </label>
          <textarea
            id="lesson-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Add a note about ${lessonTitle}…`}
            rows={3}
            className="resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/48"
          />
          <div className="h-px w-full rounded-xl bg-foreground/12" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground/48">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Draft Saved
            </div>
            <Button
              size="sm"
              onClick={saveDraft}
              disabled={!draft.trim()}
              className="rounded-xl px-4"
            >
              Add Note
            </Button>
          </div>
        </div>
      </Card>

      {isHydrated && notes.length > 0 && (
        <Card>
          <p className="text-xl font-medium text-foreground/64">Your Notes &middot; {notes.length}</p>
          <ul className="flex flex-col gap-4">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start gap-2 text-sm">
                <Bookmark size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <p className="flex-1 text-foreground/64">{note.text}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeNote(lessonSlug, note.id)}
                  aria-label="Delete note"
                  className="-m-1 text-foreground/35 hover:bg-transparent hover:text-destructive"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
