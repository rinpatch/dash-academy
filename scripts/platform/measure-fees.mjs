#!/usr/bin/env node
/**
 * Measures what a progress document actually costs, by watching the academy identity's
 * balance across a real create and a real update.
 *
 * Every figure in the design doc is derived from the published fee schedule, and the soft
 * part is GroveDB index overhead, which is not documented. Fees are identical on testnet, so
 * this replaces the estimates with measurements at no real cost.
 *
 *   DASH_NETWORK=testnet node scripts/platform/measure-fees.mjs
 */
import { randomBytes } from "node:crypto";
import { Document } from "@dashevo/evo-sdk";
import { academySigner, connect, formatCredits, requireEnv } from "./lib.mjs";

const contractId = requireEnv("DASH_ACADEMY_CONTRACT_ID");
const { sdk, network } = await connect();
const { identityId, signer, identityKey } = await academySigner(sdk);

if (network === "mainnet" && !process.argv.includes("--yes-mainnet")) {
  console.error("Refusing to spend mainnet credits without --yes-mainnet.");
  process.exit(1);
}

const balance = async () => (await sdk.identities.balance(identityId)) ?? 0n;
const properties = {
  learnerKey: new Uint8Array(randomBytes(32)),
  version: 1,
  completed: new Uint8Array(4),
  // 77 bytes is a typical ES256 COSE key, the common case for a platform authenticator.
  credentialPublicKey: new Uint8Array(randomBytes(77)),
};

console.log(`Network: ${network}\nIdentity: ${identityId}\n`);

const beforeCreate = await balance();
const document = new Document({
  properties,
  documentTypeName: "progress",
  dataContractId: contractId,
  ownerId: identityId,
});
await sdk.documents.create({ document, identityKey, signer });
const afterCreate = await balance();
const createCost = beforeCreate - afterCreate;
console.log(`create: ${formatCredits(createCost)}`);

// Flip one bit: the whole point of the fixed-width bitfield is that this changes no bytes,
// so the update should pay processing only and no storage.
const updated = new Document({
  properties: { ...properties, completed: new Uint8Array([1, 0, 0, 0]) },
  documentTypeName: "progress",
  dataContractId: contractId,
  ownerId: identityId,
  id: document.id.toString(),
  revision: 2n,
});
await sdk.documents.replace({ document: updated, identityKey, signer });
const afterUpdate = await balance();
const updateCost = afterCreate - afterUpdate;
console.log(`update: ${formatCredits(updateCost)}`);

const lifetime = createCost + updateCost * 25n;
console.log(`\nProjected lifetime (1 create + 25 updates): ${formatCredits(lifetime)}`);
console.log(`Per 10,000 learners: ${formatCredits(lifetime * 10000n)}`);
console.log(`\nUpdate is ${(Number(createCost) / Number(updateCost)).toFixed(1)}x cheaper than create.`);
