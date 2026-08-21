#!/usr/bin/env node
/**
 * Creates the academy's Platform identity — the one that owns the contract and signs every
 * progress write. Run once per network.
 *
 * Generates a key, prints the platform address to fund, waits for the funds to land, then
 * creates the identity. Funding is manual because it needs Core-chain coins: the bridge
 * turns them into a platform address balance.
 *
 *   DASH_NETWORK=testnet node scripts/platform/create-identity.mjs
 *
 * Prints the exact resume command if you need to stop, so a timeout doesn't strand whatever
 * you already sent. Note the `--` separator: npm eats flags that come before it.
 */
import { setTimeout as sleep } from "node:timers/promises";
import {
  Identity,
  Identifier,
  IdentityPublicKey,
  IdentitySigner,
  PlatformAddressSigner,
  PrivateKey,
  wallet,
} from "@dashevo/evo-sdk";
import { connect, formatCredits, network } from "./lib.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

const net = network();
const { sdk } = await connect();

// One key funds the identity, a second one signs for it. Keeping them separate means the
// funding key can be discarded once it is empty.
const fundingWif = arg("--wif") ?? (await wallet.generateKeyPair(net)).privateKeyWif;
const fundingKey = PrivateKey.fromWIF(fundingWif);
const addressSigner = new PlatformAddressSigner();
const address = addressSigner.addKey(fundingKey);
const bech32m = address.toBech32m(net);

console.log(`Network:  ${net}`);
console.log(`Address:  ${bech32m}`);
console.log(`Key:      ${fundingWif}\n`);
// npm swallows flags that come before `--`, so spell the separator out rather than naming
// the flag and letting the reader guess.
const resume = `npm run platform:create-identity -- --wif ${fundingWif}`;

const balanceOf = async () => (await sdk.addresses.get(bech32m))?.balance ?? 0n;

// Registering the contract is the expensive part: 0.1 DASH base + 0.02 per document type
// + 0.01 per index — 0.17 DASH for ours. Ask for that plus room for identity creation and a
// working balance for progress writes.
const REQUIRED = 25_000_000_000n;

// Fees come out of whatever is left on the address after the requested amount, so the whole
// balance can never be moved at once.
const FEE_RESERVE = 100_000_000n;

let balance = await balanceOf();
if (balance < REQUIRED) {
  console.log(`Fund it with at least ${formatCredits(REQUIRED)}:`);
  console.log(`  https://bridge.thepasta.org/?address=${bech32m}\n`);
  console.log("Checking every 10s. Press Enter to check now, Ctrl-C to stop.");
  console.log(`Resume later with:\n  ${resume}\n`);

  // Enter cuts the current wait short, so whoever just watched the bridge confirm doesn't
  // sit through the rest of the interval. The flag matters: a keypress that lands while we
  // are querying the balance rather than sleeping would otherwise be swallowed.
  let nudged = false;
  let wake = () => {
    nudged = true;
  };
  process.stdin.on("data", () => wake());
  process.stdin.resume();

  for (let i = 0; i < 60 && balance < REQUIRED; i++) {
    if (!nudged) {
      const waking = new AbortController();
      wake = () => {
        nudged = true;
        waking.abort();
      };
      await sleep(10_000, undefined, { signal: waking.signal }).catch(() => {});
    }
    nudged = false;
    balance = await balanceOf();
    if (balance < REQUIRED) process.stdout.write(".");
  }

  process.stdin.pause();
  console.log();
}

if (balance < REQUIRED) {
  console.error(`\nStill only ${formatCredits(balance)}. Resume with:\n  ${resume}`);
  process.exit(1);
}
console.log(`Funded: ${formatCredits(balance)}\n`);

// Master key updates the identity; the high-security key signs everything else. The
// protocol requires exactly one master key and recommends a second for normal signing.
const identityKeyPairs = await Promise.all([
  wallet.generateKeyPair(net),
  wallet.generateKeyPair(net),
]);
const identitySigner = new IdentitySigner();
const identity = new Identity(new Identifier(crypto.getRandomValues(new Uint8Array(32))));

identityKeyPairs.forEach((pair, index) => {
  const key = PrivateKey.fromWIF(pair.privateKeyWif);
  identitySigner.addKey(key);
  identity.addPublicKey(
    new IdentityPublicKey({
      keyId: index,
      purpose: "AUTHENTICATION",
      securityLevel: index === 0 ? "MASTER" : "HIGH",
      keyType: "ECDSA_SECP256K1",
      data: key.getPublicKey().toBytes(),
    }),
  );
});

const result = await sdk.addresses.createIdentity({
  identity,
  inputs: [{ address: bech32m, nonce: 0, amount: balance - FEE_RESERVE }],
  identitySigner,
  addressSigner,
});

const identityId = result.identity.id.toString();
console.log("Identity created.\n");
console.log("Add to .env.local:\n");
console.log(`DASH_ACADEMY_IDENTITY_ID=${identityId}`);
console.log(`DASH_ACADEMY_PRIVATE_KEY_WIF=${identityKeyPairs[1].privateKeyWif}\n`);
console.log(`Master key (keep offline, needed only to change the identity's keys):`);
console.log(`  ${identityKeyPairs[0].privateKeyWif}`);
