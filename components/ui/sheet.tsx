"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { buttonVariants } from "@/components/ui/button";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetDescription = DialogPrimitive.Description;

/** A dialog that rises from the bottom edge — the reachable spot on a phone. */
function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "sheet-content-enter fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl bg-background shadow-2xl shadow-foreground/20",
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-4">
          <DialogPrimitive.Title className="text-lg font-extrabold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className: "rounded-xl text-foreground/48",
            })}
          >
            <XIcon size={16} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTrigger };
