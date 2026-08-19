"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";
import { GLOSSARY } from "@/lib/glossary";

export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = GLOSSARY[id];
  // An unknown id must never swallow lesson text, so fall back to plain prose.
  if (!entry) {
    if (process.env.NODE_ENV !== "production") console.warn(`<Term> has no glossary entry for "${id}"`);
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-sm bg-primary/12 px-1 font-semibold text-primary underline decoration-primary/40 decoration-dotted underline-offset-4 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`${entry.title} — show definition`}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="not-prose max-w-80 p-4">
        <p className="text-sm font-extrabold text-foreground">{entry.title}</p>
        <p className="mt-1 text-sm font-medium leading-6 text-foreground/64">{entry.definition}</p>
        {entry.tag && (
          <span className="mt-3 inline-block rounded-full bg-foreground/8 px-3 py-1 text-xs font-bold text-foreground/64">
            {entry.tag}
          </span>
        )}
        {entry.href && (
          <Link href={entry.href} className="mt-3 block text-xs font-bold text-primary hover:underline">
            Read the full lesson
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
