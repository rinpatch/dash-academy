#!/usr/bin/env node
/**
 * Registers contracts/dash-academy.schema.json on the configured network.
 *
 * Run this once per network. It prints the resulting contract id, which becomes
 * DASH_ACADEMY_CONTRACT_ID. Registration is not idempotent — running it twice creates a
 * second, unrelated contract — so it refuses to proceed if DASH_ACADEMY_CONTRACT_ID is
 * already set unless --force is passed.
 *
 *   DASH_NETWORK=testnet node scripts/platform/register-contract.mjs
 */
import { DataContract } from "@dashevo/evo-sdk";
import { academySigner, connect, formatCredits, loadSchema } from "./lib.mjs";

const force = process.argv.includes("--force");

if (process.env.DASH_ACADEMY_CONTRACT_ID && !force) {
  console.error(
    `DASH_ACADEMY_CONTRACT_ID is already set to ${process.env.DASH_ACADEMY_CONTRACT_ID}.\n` +
      "Registering again would create a second, unrelated contract and orphan every existing\n" +
      "progress document. Pass --force if that is what you want.",
  );
  process.exit(1);
}

const { sdk, network } = await connect();
const { identityId, signer, identityKey } = await academySigner(sdk);
const schemas = await loadSchema();

const before = await sdk.identities.balance(identityId);
console.log(`Network:  ${network}`);
console.log(`Identity: ${identityId}`);
console.log(`Balance:  ${formatCredits(before ?? 0n)}`);
console.log(`Types:    ${Object.keys(schemas).join(", ")}\n`);

const identityNonce = ((await sdk.identities.nonce(identityId)) ?? 0n) + 1n;
const dataContract = new DataContract({ ownerId: identityId, identityNonce, schemas });

const published = await sdk.contracts.publish({ dataContract, identityKey, signer });
const contractId = published.id.toString();

const after = await sdk.identities.balance(identityId);
console.log(`Registered: ${contractId}`);
console.log(`Cost:       ${formatCredits((before ?? 0n) - (after ?? 0n))}\n`);
console.log(`Set DASH_ACADEMY_CONTRACT_ID=${contractId}`);
