import "server-only";

type Client = Awaited<ReturnType<typeof build>>;
type SdkModule = typeof import("@dashevo/wasm-sdk");

const globalForDash = globalThis as unknown as {
  dashAcademySdk?: Promise<SdkModule>;
  dashAcademyClient?: Promise<Client>;
};

async function loadSdk() {
  if (!globalForDash.dashAcademySdk) {
    globalForDash.dashAcademySdk = (async () => {
      const init = (await import("@dashevo/wasm-sdk")).default;
      const sdk = await import("@dashevo/wasm-sdk");
      await init();
      return sdk;
    })();
  }
  return globalForDash.dashAcademySdk;
}

async function build() {
  const sdk = await loadSdk();
  const context = await sdk.WasmTrustedContext.prefetchTestnet();

  return sdk.WasmSdkBuilder.testnet()
    .withTrustedContext(context)
    .withSettings(8000, 15000, 3, true)
    .build();
}

export function getClient(): Promise<Client> {
  return (globalForDash.dashAcademyClient ??= build());
}

// quorums rotate on testnet, staling the cached trusted context;
// callers should invoke this and retry once when a request fails as retriable
export function resetClient() {
  globalForDash.dashAcademyClient = undefined;
}

export async function normalizeIdentityId(value: string): Promise<string | null> {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;

  try {
    const sdk = await loadSdk();
    const identifier = sdk.Identifier.fromBase58(trimmed);
    const normalized = identifier.toBase58();
    identifier.free();
    return normalized;
  } catch {
    return null;
  }
}
