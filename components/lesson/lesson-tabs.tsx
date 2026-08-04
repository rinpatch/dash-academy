"use client";

import { useState, type ReactNode } from "react";

const TABS = ["Overview", "Resources", "Discussion"] as const;
type Tab = (typeof TABS)[number];

export function LessonTabs({ overview }: { overview: ReactNode }) {
  const [active, setActive] = useState<Tab>("Overview");

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Lesson sections" className="flex items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === tab
                ? "bg-foreground/4 text-foreground"
                : "text-foreground/35 hover:text-foreground/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" hidden={active !== "Overview"}>
        {overview}
      </div>
      {/* ponytail: Resources/Discussion have no content model yet, placeholder until they do */}
      <div role="tabpanel" hidden={active !== "Resources"} className="text-sm text-foreground/60">
        Additional resources for this lesson are coming soon.
      </div>
      <div role="tabpanel" hidden={active !== "Discussion"} className="text-sm text-foreground/60">
        Discussion isn&apos;t available yet.
      </div>
    </div>
  );
}
