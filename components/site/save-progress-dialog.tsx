"use client";

import { Check, KeyRound, LoaderCircle, LogOut, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { messageFor } from "@/lib/progress/sync-messages";
import { useProgressSync } from "@/components/providers/progress-sync-provider";

const PRIMARY =
  "flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const SECONDARY =
  "flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45";

/** One passkey surface for registration, sign-in, conflict resolution, and sign-out. */
export function SaveProgressDialog() {
  const {
    status,
    failure,
    conflict,
    promptOpen,
    dismissPrompt,
    enable,
    restore,
    chooseLocal,
    choosePasskey,
    signOut,
  } = useProgressSync();
  const busy = status === "busy";
  const message = messageFor(failure);

  return (
    <Dialog open={promptOpen} onOpenChange={(open) => !open && !busy && dismissPrompt()}>
      <DialogContent showCloseButton={!busy}>
        {conflict ? (
          <>
            <DialogHeader>
              <DialogTitle>Which progress should we keep?</DialogTitle>
              <DialogDescription>
                This device and your passkey contain different progress. Choose one to keep; it
                will replace the other copy.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground/64">
              <span>
                <strong className="font-extrabold text-foreground">This device:</strong>{" "}
                {progressCount(conflict.local.length)}
              </span>
              <span>
                <strong className="font-extrabold text-foreground">Your passkey:</strong>{" "}
                {progressCount(conflict.remote.length)}
              </span>
            </div>

            {message && <FailureMessage message={message} />}

            <DialogFooter>
              <button type="button" onClick={dismissPrompt} disabled={busy} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void choosePasskey()}
                disabled={busy}
                className={SECONDARY}
              >
                Use passkey progress
              </button>
              <button
                type="button"
                onClick={() => void chooseLocal()}
                disabled={busy}
                className={PRIMARY}
              >
                {busy ? <BusyLabel /> : "Use this device"}
              </button>
            </DialogFooter>
          </>
        ) : status === "signed-in" ? (
          <>
            <DialogHeader>
              <DialogTitle>Progress is saved</DialogTitle>
              <DialogDescription>
                You’re signed in with a passkey. New lesson progress will save automatically.
              </DialogDescription>
            </DialogHeader>

            <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground/64">
              <Check size={15} className="shrink-0 text-primary" aria-hidden="true" />
              <span>This device is connected to your saved progress.</span>
            </p>

            <DialogFooter>
              <button type="button" onClick={() => void signOut()} className={SECONDARY}>
                <LogOut size={14} aria-hidden="true" />
                Sign out on this device
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Save your progress</DialogTitle>
              <DialogDescription>
                Create a passkey or sign in with one you already have. We’ll reconcile this
                device with its saved progress before anything is replaced.
              </DialogDescription>
            </DialogHeader>

            <p className="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm leading-6 text-foreground/64">
              <TriangleAlert size={15} className="mt-1 shrink-0 text-warning" aria-hidden="true" />
              <span>The passkey is the only key to your record. Lose it and there is no recovery.</span>
            </p>

            {message && <FailureMessage message={message} />}

            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:justify-start">
              <button
                type="button"
                onClick={dismissPrompt}
                disabled={busy}
                className={`${SECONDARY} justify-self-start sm:mr-auto`}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void restore()}
                disabled={busy}
                className={`${SECONDARY} justify-self-end`}
              >
                Sign in with a passkey
              </button>
              <button
                type="button"
                onClick={() => void enable()}
                disabled={busy}
                className={`${PRIMARY} col-span-2 w-full sm:w-auto`}
              >
                {busy ? (
                  <BusyLabel />
                ) : (
                  <>
                    <KeyRound size={14} aria-hidden="true" />
                    {failure === "no-record" ? "Create new passkey" : "Create a passkey"}
                  </>
                )}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BusyLabel() {
  return (
    <>
      <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
      Working…
    </>
  );
}

function FailureMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-warning">
      <TriangleAlert size={15} className="mt-1 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function progressCount(count: number) {
  return `${count} completed ${count === 1 ? "checkpoint" : "checkpoints"}`;
}
