"use client";

import Link from "next/link";
import { Circle, CircleCheckBig, CircleDashed, CirclePlay } from "lucide-react";
import { useActiveAnchor } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";
import { Card } from "@/components/ui/card";
import { useCompletedLessonIds } from "@/components/providers/progress-provider";

export type LessonSummary = {
  slug: string;
  module: number;
  url: string;
  title: string;
  estimatedMinutes: number;
  exp: number;
  isDraft: boolean;
};

export function LessonNavList({
  lessons,
  currentUrl,
  toc,
}: {
  lessons: LessonSummary[];
  currentUrl: string;
  toc: TableOfContents;
}) {
  const { lessonIds: completedSlugs, isHydrated } = useCompletedLessonIds();

  return (
    <div className="flex flex-col gap-3">
      {lessons.map((lesson) => (
        <LessonNavItem
          key={lesson.url}
          lesson={lesson}
          isCurrent={lesson.url === currentUrl}
          isCompleted={isHydrated && completedSlugs.has(lesson.slug)}
          toc={lesson.url === currentUrl ? toc : undefined}
        />
      ))}
    </div>
  );
}

function LessonNavItem({
  lesson,
  isCurrent,
  isCompleted,
  toc,
}: {
  lesson: LessonSummary;
  isCurrent: boolean;
  isCompleted: boolean;
  toc?: TableOfContents;
}) {
  return (
    <Card
      className={
        lesson.isDraft
          ? "gap-4 border border-dashed border-foreground/24 bg-transparent opacity-60"
          : "gap-4"
      }
    >
      <Link href={lesson.url} className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`w-6 shrink-0 text-sm font-extrabold tabular-nums ${
            isCurrent ? "text-primary" : "text-foreground/32"
          }`}
        >
          {String(lesson.module).padStart(2, "0")}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-extrabold">{lesson.title}</p>
          <p className="text-xs font-medium text-foreground/48">
            {lesson.isDraft
              ? "Not written yet"
              : `${lesson.estimatedMinutes} Mins \u00b7 ${lesson.exp} Exp`}
          </p>
        </div>
        <StatusIcon completed={isCompleted} current={isCurrent} draft={lesson.isDraft} />
      </Link>

      {toc && toc.length > 0 && (
        <>
          <div className="h-px w-full rounded-xl bg-foreground/12" />
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">On this page:</p>
            <TocList toc={toc} />
          </div>
        </>
      )}
    </Card>
  );
}

function TocList({ toc }: { toc: TableOfContents }) {
  const activeId = useActiveAnchor();

  return (
    <ul className="flex flex-col gap-3 text-xs font-medium">
      {toc.map((item) => {
        const active = activeId === item.url.slice(1);
        return (
          <li key={item.url}>
            <a
              href={item.url}
              className={`-ml-px block border-l-2 pl-3 transition-colors ${
                active ? "border-primary text-primary" : "border-foreground/12 text-foreground/48"
              }`}
            >
              {item.title}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function StatusIcon({
  completed,
  current,
  draft,
}: {
  completed: boolean;
  current: boolean;
  draft: boolean;
}) {
  if (draft) {
    return <CircleDashed size={22} aria-hidden="true" className="shrink-0 text-foreground/40" />;
  }

  if (completed) {
    return <CircleCheckBig size={22} aria-hidden="true" className="shrink-0 fill-primary text-white" />;
  }

  if (current) {
    return <CirclePlay size={22} aria-hidden="true" className="shrink-0 fill-primary/12 text-primary" />;
  }

  return <Circle size={22} aria-hidden="true" className="shrink-0 text-foreground/24" />;
}
