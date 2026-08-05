"use client";

import { useEffect, useState } from "react";
import { IdentityVerifier } from "@/components/lesson/identity-verifier";
import { useDashPlatformExtension } from "@/lib/dash-platform-extension";

const STORE_URL =
  "https://chromewebstore.google.com/detail/dash-platform-extension/odmphbcnlldggfhcpdjgnlhbehoicdnf";

type ConnectState =
  | { step: "detecting" }
  | { step: "not-installed" }
  | { step: "ready" }
  | { step: "connecting" }
  | { step: "connected"; identityId: string }
  | { step: "no-identity" }
  | { step: "error"; message: string };

export function WalletSetup({ challengeId }: { challengeId: "create-a-dash-identity" }) {
  const extensionAvailable = useDashPlatformExtension();
  // Always starts as "detecting" on both server and the first client render — `window` isn't
  // available during SSR, and computing the real state synchronously on the client would
  // mismatch the server-rendered HTML. The real check runs after mount, once hydration is safe.
  const [state, setState] = useState<ConnectState>({ step: "detecting" });

  useEffect(() => {
    if (extensionAvailable === null || state.step !== "detecting") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(extensionAvailable ? { step: "ready" } : { step: "not-installed" });
  }, [extensionAvailable, state.step]);

  async function connect() {
    setState({ step: "connecting" });
    try {
      const { currentIdentity } = await window.dashPlatformExtension!.signer.connect();
      setState(currentIdentity ? { step: "connected", identityId: currentIdentity } : { step: "no-identity" });
    } catch {
      setState({
        step: "error",
        message: "The extension declined to connect. Try again, or check the extension's permission settings for this site.",
      });
    }
  }

  return (
    <section
      className="not-prose my-8 rounded-lg border border-border bg-card"
      aria-labelledby="wallet-setup-title"
    >
      <div className="border-b border-border p-5">
        <h2 id="wallet-setup-title" className="text-xl font-semibold text-card-foreground">
          Connect your wallet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Dash Academy uses the Dash Platform Extension to create and hold your testnet identity.
          Your keys never leave the extension or touch Dash Academy&apos;s servers.
        </p>
      </div>

      <div className="p-5" aria-live="polite" aria-atomic="true">
        {state.step === "detecting" && (
          <p className="text-sm text-muted-foreground">Checking for the Dash Platform Extension…</p>
        )}

        {state.step === "not-installed" && (
          <div className="rounded-md bg-secondary p-4 text-sm text-secondary-foreground">
            <p className="font-medium">Install the Dash Platform Extension</p>
            <p className="mt-1 text-muted-foreground">
              It&apos;s required to continue this lesson: it creates, funds, and holds your testnet
              identity in the browser, and signs transactions without ever sharing your keys with
              this site.
            </p>
            <a
              href={STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              Get the extension
            </a>
            <button
              type="button"
              onClick={() => setState(window.dashPlatformExtension ? { step: "ready" } : { step: "not-installed" })}
              className="mt-3 ml-3 rounded-sm text-sm font-medium underline underline-offset-4"
            >
              I installed it, check again
            </button>
          </div>
        )}

        {state.step === "ready" && (
          <button
            type="button"
            onClick={connect}
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
          >
            Connect Wallet
          </button>
        )}

        {state.step === "connecting" && (
          <p className="text-sm text-muted-foreground">Waiting for the extension…</p>
        )}

        {state.step === "no-identity" && (
          <div className="rounded-md bg-warning/10 p-4 text-sm text-foreground">
            <p className="font-semibold">No identity selected</p>
            <p className="mt-1">
              Open the extension, create or select a testnet identity, then connect again.
            </p>
            <button
              type="button"
              onClick={connect}
              className="mt-3 rounded-sm font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {state.step === "error" && (
          <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Connection failed</p>
            <p className="mt-1">{state.message}</p>
            <button
              type="button"
              onClick={connect}
              className="mt-3 rounded-sm font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {state.step === "connected" && (
        <IdentityVerifier challengeId={challengeId} initialIdentityId={state.identityId} />
      )}
    </section>
  );
}
