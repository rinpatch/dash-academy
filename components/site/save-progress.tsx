"use client";

import { Check, CloudOff, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { useProgressSync } from "@/components/providers/progress-sync-provider";

const BUTTON =
  "flex h-10 items-center gap-2 rounded-xl border border-foreground/24 px-3 text-sm font-medium text-foreground/64 transition-colors hover:bg-foreground/5";

/**
 * Opt-in progress sync.
 *
 * Absent entirely until it can do something useful — a learner who never presses it should
 * not be nagged, and progress keeps working locally either way.
 */
export function SaveProgress() {
  const { status, failure, enable, restore, signOut } = useProgressSync();

  const message =
    failure === "no-prf"
      ? "This device's passkey can't derive a key. Try a different browser or device."
      : failure === "cancelled"
        ? "Cancelled. Try again when you're ready."
        : failure === "no-record"
          ? "No saved progress found for that passkey."
          : failure === "unavailable"
            ? "Progress sync isn't configured on this server."
            : failure
              ? "Couldn't save progress. Try again."
              : null;

  if (status === "checking" || status === "unsupported") return null;

  if (status === "busy") {
    return (
      <span className={BUTTON} aria-live="polite">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">Saving…</span>
      </span>
    );
  }

  if (status === "signed-in") {
    return (
      <button
        type="button"
        onClick={() => void signOut()}
        title="Progress is saved to Dash Platform. Click to sign out on this device."
        className={BUTTON}
      >
        <Check size={14} className="text-primary" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">Progress saved</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span
          role="status"
          title={message}
          className="hidden max-w-[22ch] items-center gap-1.5 text-xs text-warning lg:flex"
        >
          <TriangleAlert size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{message}</span>
        </span>
      ) : null}
      <button type="button" onClick={() => void enable()} className={BUTTON}>
        <Save size={14} aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">Save progress</span>
      </button>
      <button
        type="button"
        onClick={() => void restore()}
        title="Already saved progress on another device? Restore it with your passkey."
        aria-label="Restore progress with a passkey"
        className="flex size-10 items-center justify-center rounded-xl border border-foreground/24 text-foreground/64 transition-colors hover:bg-foreground/5"
      >
        <CloudOff size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
