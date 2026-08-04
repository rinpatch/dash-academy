"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useChallengeProgress } from "@/components/providers/progress-provider";

type VerifiedResponse = {
  status: "verified";
  identity: { id: string; balanceCredits: string | null; publicKeyCount: number };
};

type FailureResponse = {
  status: "invalid" | "not_found" | "unavailable";
  message: string;
};

type VerificationResponse = VerifiedResponse | FailureResponse;

export function IdentityVerifier({
  challengeId,
}: {
  challengeId: "create-a-dash-identity";
}) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const statusRef = useRef<HTMLDivElement>(null);
  const [identityId, setIdentityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const { completion, isHydrated, complete } = useChallengeProgress(challengeId);
  const restoredId = isHydrated ? completion?.evidence.identityId ?? null : null;

  useEffect(() => {
    if (result && !loading) statusRef.current?.focus();
  }, [loading, result]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = identityId.trim();
    if (!value || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId: value }),
      });
      const data = (await response.json()) as VerificationResponse;
      setResult(data);

      if (data.status === "verified") {
        complete({ identityId: data.identity.id });
      }
    } catch {
      setResult({
        status: "unavailable",
        message: "The verification request was interrupted. Your identity ID is unchanged—try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const verified = result?.status === "verified" ? result : null;

  return (
    <section
      id="verify-on-testnet"
      className="not-prose my-8 rounded-3xl bg-card"
      aria-labelledby="verification-title"
    >
      <div className="border-b border-foreground/12 p-5">
        <h2 id="verification-title" className="text-xl font-extrabold text-card-foreground">
          Verify on testnet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/64">
          Paste the public identity ID printed by your script. Dash Academy will look it up independently on Dash Platform testnet.
        </p>
      </div>

      <form onSubmit={verify} className="p-5">
        <label htmlFor={inputId} className="text-sm font-medium text-card-foreground">
          Dash identity ID
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            value={identityId}
            onChange={(event) => setIdentityId(event.target.value)}
            placeholder="Paste the Base58 identity ID"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            aria-describedby={descriptionId}
            aria-invalid={result?.status === "invalid" || result?.status === "not_found"}
            className="h-10 min-w-0 flex-1 rounded-xl border border-foreground/24 bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-foreground/48 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
          />
          <button
            type="submit"
            disabled={loading || identityId.trim().length === 0}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking testnet…" : "Verify identity"}
          </button>
        </div>
        <p id={descriptionId} className="mt-2 text-sm text-foreground/48">
          This is public testnet data. Never paste a mnemonic or private key.
        </p>
      </form>

      <div
        ref={statusRef}
        tabIndex={-1}
        className="px-5 pb-5 outline-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading && (
          <div role="status" className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
            <p className="font-medium">Checking testnet…</p>
            <p className="mt-1 text-foreground/64">This can take a few seconds.</p>
          </div>
        )}

        {verified && (
          <div className="rounded-2xl bg-mint/15 p-4 text-card-foreground">
            <p className="text-sm font-extrabold">Verified on testnet</p>
            <p className="mt-1 text-sm text-foreground/64">
              Dash Platform returned the identity and its public state.
            </p>
            <dl className="mt-4 divide-y divide-mint/35 text-sm">
              <Fact label="Identity ID" value={verified.identity.id} />
              <Fact label="Public keys" value={String(verified.identity.publicKeyCount)} />
              <Fact
                label="Credit balance"
                value={
                  verified.identity.balanceCredits
                    ? `${formatCredits(verified.identity.balanceCredits)} credits`
                    : "Available on Platform"
                }
              />
            </dl>
          </div>
        )}

        {!loading && result && result.status !== "verified" && (
          <div
            role="alert"
            className={`rounded-2xl p-4 text-sm ${
              result.status === "unavailable"
                ? "bg-warning/10 text-foreground"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            <p className="font-extrabold">
              {result.status === "unavailable"
                ? "Testnet did not answer"
                : result.status === "invalid"
                  ? "That ID is not valid"
                  : "Identity not found"}
            </p>
            <p className="mt-1">{result.message}</p>
            <button
              type="button"
              className="mt-3 rounded-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setResult(null)}
            >
              Edit and try again
            </button>
          </div>
        )}

        {!loading && !result && restoredId && (
          <div className="rounded-2xl bg-mint/15 p-4 text-sm text-card-foreground">
            <p className="font-extrabold">Previously verified</p>
            <p className="mt-1 text-foreground/64">
              Identity <span className="break-all font-mono text-foreground">{restoredId}</span> is saved in this browser.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-foreground/48">{label}</dt>
      <dd className="min-w-0 break-all font-mono">{value}</dd>
    </div>
  );
}

function formatCredits(value: string) {
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}
