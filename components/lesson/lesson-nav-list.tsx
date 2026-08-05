"use client";

import Link from "next/link";
import { Circle, CircleCheckBig, CirclePlay } from "lucide-react";
import { useActiveAnchor } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";
import { Card } from "@/components/ui/card";
import { useCompletedChallenges } from "@/components/providers/progress-provider";

export type LessonSummary = {
  slug: string;
  url: string;
  title: string;
  estimatedMinutes: number;
  exp: number;
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
  const { completedChallenges, isHydrated } = useCompletedChallenges();
  const completedSlugs = completedChallenges as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-3">
      {lessons.map((lesson) => (
        <LessonNavItem
          key={lesson.url}
          lesson={lesson}
          isCurrent={lesson.url === currentUrl}
          isCompleted={isHydrated && Boolean(completedSlugs[lesson.slug])}
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
    <Card className="gap-4">
      <Link href={lesson.url} className="flex items-center gap-3">
        <StatusIcon completed={isCompleted} current={isCurrent} />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-extrabold">{lesson.title}</p>
          <p className="text-xs font-medium text-foreground/48">
            {lesson.estimatedMinutes} Mins &middot; {lesson.exp} Exp
          </p>
        </div>
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

function StatusIcon({ completed, current }: { completed: boolean; current: boolean }) {
  if (completed) {
    return <CircleCheckBig size={22} aria-hidden="true" className="shrink-0 fill-primary text-white" />;
  }

  if (current) {
    return <CirclePlay size={22} aria-hidden="true" className="shrink-0 fill-primary/12 text-primary" />;
  }

  return <Circle size={22} aria-hidden="true" className="shrink-0 text-foreground/24" />;
}
