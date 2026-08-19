"use client";

import { useEffect, useState } from "react";

export type AppConnectInfo = {
  identities: string[];
  currentIdentity: string | null;
};

declare global {
  interface Window {
    dashPlatformExtension?: {
      signer: {
        connect: () => Promise<AppConnectInfo>;
      };
    };
  }
}

/**
 * Whether the Dash Platform Extension is installed, or `null` while still checking.
 *
 * The extension injects `window.dashPlatformExtension` asynchronously, so it isn't
 * necessarily present yet on the tick React mounts on — poll briefly instead of a
 * one-shot check, which would false-negative on any page that hasn't idled first.
 */
export function useDashPlatformExtension(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (window.dashPlatformExtension) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailable(true);
      return;
    }

    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (window.dashPlatformExtension) {
        setAvailable(true);
        clearInterval(id);
      } else if (tries >= 20) {
        // 20 x 150ms = 3s ceiling, then assume not installed. Bump if the
        // extension's injection turns out to lag further on slow machines.
        setAvailable(false);
        clearInterval(id);
      }
    }, 150);

    return () => clearInterval(id);
  }, []);

  return available;
}
