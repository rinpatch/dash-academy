import "server-only";
import { z } from "zod";

/**
 * Server config for Platform writes. Not validated at import — the app has to build and serve
 * lessons with none of it set, so missing config means "sync unavailable", not a crash.
 */
const schema = z.object({
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  identityId: z.string().min(1),
  privateKeyWif: z.string().min(1),
  contractId: z.string().min(1),
  /**
   * Salt for the credential-derived document locator. It prevents a public document ID from
   * becoming a lookup table for WebAuthn credential IDs.
   */
  learnerKeySalt: z.string().min(16),
});

export type PlatformConfig = z.infer<typeof schema>;

let cached: PlatformConfig | null | undefined;

/** Returns null when sync is not configured, rather than throwing. */
export function getPlatformConfig(): PlatformConfig | null {
  if (cached !== undefined) return cached;
  const parsed = schema.safeParse({
    network: process.env.DASH_NETWORK,
    identityId: process.env.DASH_ACADEMY_IDENTITY_ID,
    privateKeyWif: process.env.DASH_ACADEMY_PRIVATE_KEY_WIF,
    contractId: process.env.DASH_ACADEMY_CONTRACT_ID,
    learnerKeySalt: process.env.DASH_LEARNER_KEY_SALT,
  });
  cached = parsed.success ? parsed.data : null;
  return cached;
}

export function resetPlatformConfig() {
  cached = undefined;
}
