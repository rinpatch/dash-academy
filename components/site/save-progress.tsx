"use client";

import { LoaderCircle, UserRound } from "lucide-react";
import { useProgressSync } from "@/components/providers/progress-sync-provider";

const PROFILE_BUTTON =
  "flex size-10 items-center justify-center rounded-xl border border-foreground/24 text-foreground/64 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-45";

/** The header only opens the profile; progress feedback belongs to the save event itself. */
export function SaveProgress() {
  const { status, openPrompt } = useProgressSync();

  if (status === "checking" || status === "unsupported") return null;

  const busy = status === "busy";
  const saved = status === "signed-in";

  return (
    <button
      type="button"
      onClick={openPrompt}
      disabled={busy}
      title={saved ? "Open passkey profile. Progress saves automatically." : "Open passkey profile"}
      aria-label={saved ? "Open passkey profile. Progress saves automatically." : "Open passkey profile"}
      className={`${PROFILE_BUTTON} ${saved ? "text-primary" : ""}`}
    >
      {busy ? (
        <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
      ) : (
        <UserRound size={17} aria-hidden="true" />
      )}
    </button>
  );
}
