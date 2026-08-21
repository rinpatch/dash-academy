"use client";

import type { ComponentProps } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

export function ScrollArea({
  className = "",
  viewportClassName = "",
  children,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & { viewportClassName?: string }) {
  return (
    <ScrollAreaPrimitive.Root
      type="hover"
      scrollHideDelay={600}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={`size-full rounded-[inherit] focus-visible:outline-none ${viewportClassName}`}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className = "",
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={`flex touch-none select-none p-px transition-opacity duration-200 data-[state=hidden]:opacity-0 ${
        orientation === "vertical"
          ? "h-full w-2.5 border-l border-l-transparent"
          : "w-full flex-col h-2.5 border-t border-t-transparent"
      } ${className}`}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-xl bg-foreground/16 transition-colors hover:bg-foreground/28 active:bg-primary/56" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
