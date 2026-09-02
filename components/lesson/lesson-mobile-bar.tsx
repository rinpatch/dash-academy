"use client";

import { useState, type MouseEvent } from "react";
import { ListTree, NotebookPen } from "lucide-react";
import type { TableOfContents } from "fumadocs-core/toc";
import { CourseTrackCard } from "@/components/lesson/course-track-card";
import { LessonNavList, type LessonSummary } from "@/components/lesson/lesson-nav-list";
import { NotesPanel } from "@/components/lesson/notes-panel";
import { useNotesStore } from "@/components/providers/notes-provider";
import { useCompletedLessonIds } from "@/components/providers/progress-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type OpenSheet = "contents" | "notes" | null;

/**
 * Below lg the two sidebars are off the page, so this bar carries them: track progress stays
 * visible, and contents and notes each open in a sheet.
 */
export function LessonMobileBar({
  lessons,
  currentUrl,
  toc,
  lessonSlug,
  lessonTitle,
}: {
  lessons: LessonSummary[];
  currentUrl: string;
  toc: TableOfContents;
  lessonSlug: string;
  lessonTitle: string;
}) {
  const [open, setOpen] = useState<OpenSheet>(null);
  const { lessonIds, isHydrated } = useCompletedLessonIds();
  const noteCount = useNotesStore((state) => state.notesByLesson[lessonSlug]?.length ?? 0);

  const completedCount = isHydrated ? lessonIds.size : 0;
  const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  // A tap on any link inside the contents sheet is a jump away from it, so the sheet gets out
  // of the way rather than leaving the reader to close it.
  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(null);
  }

  return (
    <div className="sticky top-(--header-height) z-30 border-b border-foreground/12 bg-card lg:hidden">
      <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-2 sm:px-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen("contents")}
          className="gap-2 rounded-xl"
        >
          <ListTree size={15} aria-hidden="true" />
          Contents
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            role="progressbar"
            aria-label="Course progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1 w-full rounded-full bg-foreground/10"
          >
            <div
              className="h-1 rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-center text-[11px] font-medium text-foreground/48">
            {completedCount} / {lessons.length} Lessons
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen("notes")}
          className="gap-2 rounded-xl"
        >
          <NotebookPen size={15} aria-hidden="true" />
          Notes
          {noteCount > 0 && (
            <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-extrabold text-primary">
              {noteCount}
            </span>
          )}
        </Button>
      </div>

      <Sheet open={open === "contents"} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent title="Contents">
          <div className="flex flex-col gap-4" onClick={closeOnLink}>
            <CourseTrackCard totalLessons={lessons.length} />
            <LessonNavList lessons={lessons} currentUrl={currentUrl} toc={toc} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={open === "notes"} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent title="Notes">
          <NotesPanel lessonSlug={lessonSlug} lessonTitle={lessonTitle} showHeading={false} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
