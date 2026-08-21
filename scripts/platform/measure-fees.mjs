#!/usr/bin/env node
/**
 * Measures what a progress document actually costs, by watching the academy identity's
 * balance across a real create and a real update.
 *
 * Fee constants are scoped to the protocol version, not the network, so testnet numbers hold
 * on mainnet only while both run the same version — testnet usually runs ahead. Re-run this
 * after any Platform upgrade, and once on mainnet before trusting a budget.
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
};

console.log(`Network: ${network}\nIdentity: ${identityId}\n`);

const now = BigInt(Date.now());
const entropy = new Uint8Array(randomBytes(32));

// Document.fromObject with raw bytes, not `new Document({ properties })`: the latter mangles
// byteArray fields into an integer array and fails deep in storage.
const asDocument = (fields, id, revision, extra = {}) =>
  Document.fromObject({
    $formatVersion: "0", $id: id, $ownerId: identityId, $dataContractId: contractId,
    $type: "progress", $revision: revision, $createdAt: now, $updatedAt: now,
    ...extra, ...fields,
  }, null);

const beforeCreate = await balance();
const document = asDocument(
  properties,
  Document.generateId("progress", identityId, contractId, entropy),
  1n,
  { $entropy: entropy },
);
await sdk.documents.create({ document, identityKey, signer });
const afterCreate = await balance();
const createCost = beforeCreate - afterCreate;
console.log(`create: ${formatCredits(createCost)}`);

// Flip one bit: the whole point of the fixed-width bitfield is that this changes no bytes,
// so the update should pay processing only and no storage.
const updated = asDocument(
  { ...properties, completed: new Uint8Array([1, 0, 0, 0]) },
  document.id.toString(),
  2n,
);
await sdk.documents.replace({ document: updated, identityKey, signer });
const afterUpdate = await balance();
const updateCost = afterCreate - afterUpdate;
console.log(`update: ${formatCredits(updateCost)}`);

const lifetime = createCost + updateCost * 25n;
console.log(`\nProjected lifetime (1 create + 25 updates): ${formatCredits(lifetime)}`);
console.log(`Per 10,000 learners: ${formatCredits(lifetime * 10000n)}`);
console.log(`\nUpdate is ${(Number(createCost) / Number(updateCost)).toFixed(1)}x cheaper than create.`);
