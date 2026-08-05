"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useDashPlatformExtension } from "@/lib/dash-platform-extension";

const STORE_URL =
  "https://chromewebstore.google.com/detail/dash-platform-extension/odmphbcnlldggfhcpdjgnlhbehoicdnf";

type State =
  | { step: "detecting" }
  | { step: "not-installed" }
  | { step: "ready" }
  | { step: "connecting" }
  | { step: "connected"; identityId: string; name: string | null }
  | { step: "error" };

export function WalletConnect() {
  const extensionAvailable = useDashPlatformExtension();
  const [state, setState] = useState<State>({ step: "detecting" });
  // Suppresses the auto-reconnect below right after an explicit log-out, so clicking it
  // doesn't just get silently reconnected on the next render.
  const loggedOut = useRef(false);

  useEffect(() => {
    if (extensionAvailable === null || state.step !== "detecting") return;
    if (!extensionAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ step: "not-installed" });
    } else if (loggedOut.current) {
      setState({ step: "ready" });
    } else {
      // Already-approved sites resolve this instantly with no popup; only a site that's
      // never been connected here before will prompt the extension's permission dialog.
      void connect();
    }
  }, [extensionAvailable, state.step]);

  async function connect() {
    setState({ step: "connecting" });
    try {
      const { currentIdentity } = await window.dashPlatformExtension!.signer.connect();
      if (!currentIdentity) {
        setState({ step: "ready" });
        return;
      }

      const name = await fetchDpnsUsername(currentIdentity);
      setState({ step: "connected", identityId: currentIdentity, name });
    } catch {
      setState({ step: "error" });
    }
  }

  if (state.step === "detecting") return null;

  if (state.step === "not-installed") {
    return (
      <a
        href={STORE_URL}
        target="_blank"
        rel="noreferrer"
        className="flex h-10 items-center rounded-xl border border-foreground/24 px-3 text-sm font-medium text-foreground/64 transition-colors hover:bg-foreground/5"
      >
        Get wallet extension
      </a>
    );
  }

  if (state.step === "connected") {
    return (
      <div
        title={state.identityId}
        className="flex h-10 items-center gap-2 rounded-xl border border-foreground/24 px-3 text-sm font-medium"
      >
        <span className="size-[18px] rounded-full bg-primary/20" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">
          <span className="text-foreground/48">Hello,</span> {state.name ?? shorten(state.identityId)}
        </span>
        <button
          type="button"
          onClick={() => {
            loggedOut.current = true;
            setState({ step: "ready" });
          }}
          aria-label="Log out"
          title="Log out"
          className="flex size-6 items-center justify-center rounded-md text-foreground/48 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <LogOut size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={state.step === "connecting"}
      className="flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {state.step === "connecting" ? "Connecting…" : state.step === "error" ? "Try again" : "Connect Wallet"}
    </button>
  );
}

function shorten(identityId: string) {
  return `${identityId.slice(0, 4)}…${identityId.slice(-4)}`;
}

async function fetchDpnsUsername(identityId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/dpns-username?identityId=${encodeURIComponent(identityId)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { username: string | null };
    return data.username;
  } catch {
    return null;
  }
}
