import { readFile } from "node:fs/promises";
import path from "node:path";
import { EvoSDK, IdentitySigner, PrivateKey } from "@dashevo/evo-sdk";

export const repoRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Shared setup for the operator scripts.
 *
 * These run from a terminal against a live network, so they read the same environment the
 * server does and fail loudly on anything missing — the opposite of the app, which degrades
 * quietly when sync is unconfigured.
 */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function network() {
  const value = process.env.DASH_NETWORK ?? "testnet";
  if (value !== "testnet" && value !== "mainnet") {
    throw new Error(`DASH_NETWORK must be testnet or mainnet, got: ${value}`);
  }
  return value;
}

export async function connect() {
  const net = network();
  const sdk = net === "mainnet" ? EvoSDK.mainnetTrusted() : EvoSDK.testnetTrusted();
  await sdk.connect();
  return { sdk, network: net };
}

export async function academySigner(sdk) {
  const identityId = requireEnv("DASH_ACADEMY_IDENTITY_ID");
  const privateKey = PrivateKey.fromWIF(requireEnv("DASH_ACADEMY_PRIVATE_KEY_WIF"));
  const signer = new IdentitySigner();
  signer.addKey(privateKey);

  const keys = await sdk.identities.getKeys({ identityId, request: { type: "all" } });
  const publicKeyHash = privateKey.getPublicKeyHash();
  const identityKey = keys.find((key) => key.getPublicKeyHash() === publicKeyHash);
  if (!identityKey) {
    throw new Error(`Configured key does not match any public key on identity ${identityId}`);
  }
  return { identityId, signer, identityKey };
}

export async function loadSchema() {
  const file = path.join(repoRoot, "contracts/dash-academy.schema.json");
  return JSON.parse(await readFile(file, "utf8"));
}

/** Credits are the unit Platform charges in; DASH is the unit humans budget in. */
export const CREDITS_PER_DASH = 100_000_000_000n;

export function formatCredits(credits) {
  const dash = Number(credits) / Number(CREDITS_PER_DASH);
  return `${credits.toLocaleString()} credits (${dash.toFixed(9)} DASH)`;
}

/**
 * WasmSdkError is a wasm object, not an Error, so Node's default handler prints an opaque
 * pointer. Its fields have to be read explicitly.
 */
export function describeError(error) {
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    const detail = [`${error.name ?? "WasmSdkError"} (${error.kind}): ${error.message}`];
    if (error.code !== undefined && error.code !== -1) detail.push(`code ${error.code}`);
    if (error.isRetriable) detail.push("retriable");
    return detail.join(" · ");
  }
  return error?.stack ?? String(error);
}

process.on("uncaughtException", (error) => {
  console.error(`\n${describeError(error)}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`\n${describeError(error)}`);
  process.exit(1);
});
