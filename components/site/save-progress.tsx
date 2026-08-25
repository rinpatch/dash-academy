"use client";

import { LoaderCircle, UserRound } from "lucide-react";
import { useProgressSync } from "@/components/providers/progress-sync-provider";
import { Button } from "@/components/ui/button";

/** The header only opens the profile; progress feedback belongs to the save event itself. */
export function SaveProgress() {
  const { status, openPrompt } = useProgressSync();

  if (status === "checking" || status === "unsupported") return null;

  const busy = status === "busy";
  const saved = status === "signed-in";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={openPrompt}
      disabled={busy}
      title={saved ? "Open passkey profile. Progress saves automatically." : "Open passkey profile"}
      aria-label={saved ? "Open passkey profile. Progress saves automatically." : "Open passkey profile"}
      className={`rounded-xl disabled:cursor-wait ${saved ? "text-primary" : ""}`}
    >
      {busy ? (
        <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
      ) : (
        <UserRound size={17} aria-hidden="true" />
      )}
    </Button>
  );
}
