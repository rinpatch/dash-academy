import "server-only";
import type { EvoSDK, IdentityPublicKey, IdentitySigner } from "@dashevo/evo-sdk";
import { getPlatformConfig, type PlatformConfig } from "@/app/lib/platform-config";

/**
 * Write-capable Platform client (Evo SDK).
 *
 * app/lib/dash.ts is the read-only, testnet-pinned wasm-sdk client used by the lesson
 * verifier. This one takes a network, since progress goes to mainnet while labs stay on
 * testnet — both run at once.
 */

export type AcademySigner = {
  sdk: EvoSDK;
  signer: IdentitySigner;
  identityKey: IdentityPublicKey;
  config: PlatformConfig;
};

const globalForPlatform = globalThis as unknown as {
  dashAcademyPlatform?: Promise<AcademySigner>;
};

async function build(config: PlatformConfig): Promise<AcademySigner> {
  const { EvoSDK, IdentitySigner, PrivateKey } = await import("@dashevo/evo-sdk");

  // Trusted mode fetches quorum keys over HTTPS, then verifies every response against them.
  // Needed anywhere without a full node, which means any web host.
  const sdk = config.network === "mainnet" ? EvoSDK.mainnetTrusted() : EvoSDK.testnetTrusted();
  await sdk.connect();

  const privateKey = PrivateKey.fromWIF(config.privateKeyWif);
  const publicKeyHash = privateKey.getPublicKeyHash();

  const signer = new IdentitySigner();
  signer.addKey(privateKey);

  const keys = await sdk.identities.getKeys({ identityId: config.identityId, request: { type: "all" } });
  const identityKey = keys.find((key) => key.getPublicKeyHash() === publicKeyHash);
  if (!identityKey) {
    throw new Error(
      `Configured private key does not match any public key on identity ${config.identityId}`,
    );
  }

  return { sdk, signer, identityKey, config };
}

/** Resolves null when sync is not configured, so callers can degrade instead of failing. */
export function getAcademySigner(): Promise<AcademySigner> | null {
  const config = getPlatformConfig();
  if (!config) return null;
  return (globalForPlatform.dashAcademyPlatform ??= build(config));
}

/** Drops the cached client. Testnet quorums rotate and stale the trusted context. */
export function resetAcademySigner() {
  globalForPlatform.dashAcademyPlatform = undefined;
}
