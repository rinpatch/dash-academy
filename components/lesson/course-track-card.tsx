"use client";

import { Card } from "@/components/ui/card";
import { useCompletedChallenges } from "@/components/providers/progress-provider";
import { getCompletedLessonIds } from "@/lib/progress";

// single hardcoded track name until the content model supports multiple tracks
const TRACK_NAME = "Dash Platform";

export function CourseTrackCard({ totalLessons }: { totalLessons: number }) {
  const { completedChallenges, isHydrated } = useCompletedChallenges();
  const completedCount = isHydrated ? getCompletedLessonIds(completedChallenges).size : 0;
  const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground/48">Course Track</p>
        <p className="text-xl font-extrabold">{TRACK_NAME}</p>
      </div>
      <div className="flex flex-col gap-3">
        <div
          role="progressbar"
          aria-label={`${TRACK_NAME} progress`}
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
        <div className="flex items-center justify-between text-sm font-extrabold">
          <span className="text-primary">{percent}%</span>
          <span className="font-medium text-foreground/48">
            {completedCount} / {totalLessons} Lessons
          </span>
        </div>
      </div>
    </Card>
  );
}
