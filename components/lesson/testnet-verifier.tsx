"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useChallengeProgress } from "@/components/providers/progress-provider";
import { Button } from "@/components/ui/button";
import type { TestnetChallengeId } from "@/lib/progress";

type VerifiedResponse = { status: "verified"; reference: string; facts: { label: string; value: string }[] };
type FailureResponse = { status: "invalid" | "not_found" | "unavailable" | "unsupported"; message: string };
type VerificationResponse = VerifiedResponse | FailureResponse;

const FAILURE_TITLE: Record<FailureResponse["status"], string> = {
  invalid: "That value is not valid",
  not_found: "Not found on testnet",
  unavailable: "Testnet did not answer",
  unsupported: "Not verifiable yet",
};

/**
 * Checkpoint for a hands-on lesson: the learner pastes the public result of their work and Dash
 * Academy looks it up on testnet independently. `operation` must match the lesson's row in
 * lesson-factory/curriculum.json; the server refuses operations it cannot actually check.
 */
export function TestnetVerifier({
  challengeId,
  operation,
  label = "Result from your script",
  placeholder = "Paste the public value your script printed",
}: {
  challengeId: TestnetChallengeId;
  operation: string;
  label?: string;
  placeholder?: string;
}) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const statusRef = useRef<HTMLDivElement>(null);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const { completion, isHydrated, complete } = useChallengeProgress(challengeId);
  const restored = isHydrated ? completion?.evidence.reference ?? null : null;

  useEffect(() => {
    if (result && !loading) statusRef.current?.focus();
  }, [loading, result]);

  async function verify(value: string) {
    if (!value || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, reference: value }),
      });
      const data = (await response.json()) as VerificationResponse;
      setResult(data);
      if (data.status === "verified") complete({ reference: data.reference });
    } catch {
      setResult({ status: "unavailable", message: "The verification request was interrupted. Your input is unchanged—try again." });
    } finally {
      setLoading(false);
    }
  }

  const verified = result?.status === "verified" ? result : null;

  return (
    <section id="verify-on-testnet" className="not-prose my-8 rounded-3xl bg-card" aria-labelledby="verification-title">
      <div className="border-b border-foreground/12 p-5">
        <h2 id="verification-title" className="text-xl font-extrabold text-card-foreground">
          Verify on testnet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/64">
          Paste the public result your script printed. Dash Academy will look it up independently on Dash Platform testnet.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void verify(reference.trim());
        }}
        className="p-5"
      >
        <label htmlFor={inputId} className="text-sm font-medium text-card-foreground">
          {label}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            aria-describedby={descriptionId}
            aria-invalid={result?.status === "invalid" || result?.status === "not_found"}
            className="h-10 min-w-0 flex-1 rounded-xl border border-foreground/24 bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-foreground/48 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
          />
          <Button
            type="submit"
            disabled={loading || reference.trim().length === 0}
            className="rounded-xl disabled:opacity-60"
          >
            {loading ? "Checking testnet…" : "Verify"}
          </Button>
        </div>
        <p id={descriptionId} className="mt-2 text-sm text-foreground/48">
          This is public testnet data. Never paste a mnemonic or private key.
        </p>
      </form>

      <div ref={statusRef} tabIndex={-1} className="px-5 pb-5 outline-none" aria-live="polite" aria-atomic="true">
        {loading && (
          <div role="status" className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
            <p className="font-medium">Checking testnet…</p>
            <p className="mt-1 text-foreground/64">This can take a few seconds.</p>
          </div>
        )}

        {verified && (
          <div className="rounded-2xl bg-mint/15 p-4 text-card-foreground">
            <p className="text-sm font-extrabold">Verified on testnet</p>
            <p className="mt-1 text-sm text-foreground/64">Dash Platform returned your work and its public state.</p>
            <dl className="mt-4 divide-y divide-mint/35 text-sm">
              {verified.facts.map((fact) => (
                <div key={fact.label} className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="font-medium text-foreground/48">{fact.label}</dt>
                  <dd className="min-w-0 break-all font-mono">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {!loading && result && result.status !== "verified" && (
          <div
            role="alert"
            className={`rounded-2xl p-4 text-sm ${
              result.status === "unavailable" || result.status === "unsupported"
                ? "bg-warning/10 text-foreground"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            <p className="font-extrabold">{FAILURE_TITLE[result.status]}</p>
            <p className="mt-1">{result.message}</p>
            <Button
              variant="link"
              className="mt-3"
              onClick={() => setResult(null)}
            >
              Edit and try again
            </Button>
          </div>
        )}

        {!loading && !result && restored && (
          <div className="rounded-2xl bg-mint/15 p-4 text-sm text-card-foreground">
            <p className="font-extrabold">Previously verified</p>
            <p className="mt-1 text-foreground/64">
              <span className="break-all font-mono text-foreground">{restored}</span> is saved in this browser.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
