#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

process.on("uncaughtException", reportError);
process.on("unhandledRejection", reportError);

const MAX_FUNDING_CREDITS = 150_000_000n;
const MAX_FEE_CREDITS = 15_000_000n;
const RESERVE_CREDITS = 100_000_000n;

const sdkUrl = pathToFileURL(path.join(process.cwd(), "node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js"));
const {
  ensureInitialized,
  EvoSDK,
  PlatformAddressSigner,
  PrivateKey,
} = await import(sdkUrl.href);
await ensureInitialized();

const keyFile = new URL("./treasury.wif", import.meta.url);
const wif = (await readFile(keyFile, "utf8")).trim();
const signer = new PlatformAddressSigner();
const source = signer.addKey(PrivateKey.fromWIF(wif));
const sourceAddress = source.toBech32m("testnet");
const sdk = EvoSDK.testnetTrusted();
await sdk.connect();

const request = await readRequest();
if (request.network !== "testnet") fail("Only testnet is allowed");
const info = await sdk.addresses.get(sourceAddress);
const balance = info?.balance ?? 0n;

if (request.action === "status") {
  respond({ balanceCredits: balance.toString() });
} else if (request.action === "fund") {
  const amount = credits(request.amountCredits, "amountCredits");
  const maxFee = credits(request.maxFeeCredits, "maxFeeCredits");
  if (amount === 0n || amount > MAX_FUNDING_CREDITS) fail("Funding amount exceeds signer policy");
  if (maxFee === 0n || maxFee > MAX_FEE_CREDITS) fail("Fee allowance exceeds signer policy");
  if (balance - amount - maxFee < RESERVE_CREDITS) fail("Treasury reserve would be breached");
  if (!info) fail("Treasury address is not funded");

  await sdk.addresses.transfer({
    inputs: [{ address: sourceAddress, nonce: Number(info.nonce), amount }],
    outputs: [{ address: request.recipient, amount }],
    signer,
  });
  const balanceAfter = (await sdk.addresses.get(sourceAddress))?.balance ?? 0n;
  if (balance - balanceAfter > amount + maxFee) fail("Observed transfer spend exceeds signer policy");
  let recipientBalance = 0n;
  for (let attempt = 0; attempt < 20 && recipientBalance < amount; attempt += 1) {
    recipientBalance = (await sdk.addresses.get(request.recipient))?.balance ?? 0n;
    if (recipientBalance < amount) await wait(1_000);
  }
  if (recipientBalance < amount) fail("Recipient funding was not readable before timeout");
  await wait(5_000);
  respond({ status: "funded", reference: request.namespace, amountCredits: amount.toString() });
} else {
  fail("Unsupported signer action");
}

async function readRequest() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw); } catch { fail("Expected one JSON request"); }
}

function credits(value, label) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) fail(`${label} must be an integer string`);
  return BigInt(value);
}

function respond(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function fail(message) {
  throw new Error(message);
}

function reportError(error) {
  const details = error && typeof error === "object" && "message" in error
    ? [error.name, error.kind, error.message, error.code].filter((value) => value !== undefined).join(": ")
    : String(error);
  process.stderr.write(`${details}\n`);
  process.exit(1);
}
