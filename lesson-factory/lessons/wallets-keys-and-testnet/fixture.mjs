import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/wallets-keys-and-testnet.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const documentedDerivationPaths = {
  testnet: "m/44'/1'/0'/0/0",
  mainnet: "m/44'/5'/0'/0/0",
};

test("lesson follows the module 7 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Wallets, keys, and testnet/);
  assert.match(mdx, /description: Handle keys safely and get the testnet funds the next lessons need\./);
  assert.match(mdx, /module: 7/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 14/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[6\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="wallets-keys-and-testnet"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers seed phrases, derivation, private-key loss, testnet, and the faucet", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "seed phrase",
    "derivation",
    "root seed",
    "deterministic",
    "512-bit",
    "128 to 256 bits",
    "private key",
    "likely lost forever",
    "no reset",
    "mainnet",
    "testnet",
    "faucet",
    "m/44'/1'/0'/0/0",
    "m/44'/5'/0'/0/0",
    "https://faucet.testnet.networks.dash.org/",
    "https://testnet-faucet.dash.org/",
    "masternode",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("lesson stays inside the mustNotCover boundary", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const forbidden of ["DIP-18", "bech32m", "bech32"]) {
    assert.ok(!mdx.includes(forbidden), `lesson must not cover: ${forbidden}`);
  }
});

test("the completing quiz checks backup, derivation, loss, network choice, and the faucet", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["wallets-keys-and-testnet"]);
  assert.match(mdx, /id: "seed-recovery"/);
  assert.match(mdx, /id: "deterministic-derivation"/);
  assert.match(mdx, /id: "private-key-loss"/);
  assert.match(mdx, /id: "testnet-choice"/);
  assert.match(mdx, /id: "faucet-funds"/);
  assert.match(mdx, /passingScore=\{4\}/);
});

test("the documented BIP44 paths match the pinned WASM SDK and separate the two networks", async () => {
  const { default: init, WasmSdk, Network } = await import("@dashevo/wasm-sdk");
  await init();

  const testnet = WasmSdk.derivationPathBip44Testnet(0, 0, 0);
  const mainnet = WasmSdk.derivationPathBip44Mainnet(0, 0, 0);

  try {
    assert.equal(testnet.path, documentedDerivationPaths.testnet, "testnet BIP44 path");
    assert.equal(mainnet.path, documentedDerivationPaths.mainnet, "mainnet BIP44 path");
    assert.equal(testnet.coinType, 1, "testnet coin type");
    assert.equal(mainnet.coinType, 5, "mainnet coin type");
    assert.notEqual(Network.Testnet, Network.Mainnet, "testnet and mainnet are distinct networks");
    assert.equal(Network.Testnet, 1);
    assert.equal(Network.Mainnet, 0);
  } finally {
    testnet.free();
    mainnet.free();
  }
});

test("every <Term> id resolves to a glossary entry", async () => {
  const [mdx, glossarySource] = await Promise.all([
    readFile(mdxUrl, "utf8"),
    readFile(new URL("../../../lib/glossary.ts", import.meta.url), "utf8"),
  ]);

  const body = glossarySource.slice(glossarySource.indexOf("GLOSSARY: Record<string, GlossaryEntry> = {"));
  const definedIds = new Set(
    [...body.matchAll(/^ {2}"?([a-z0-9-]+)"?: \{$/gm)].map((match) => match[1]),
  );

  const usedIds = [...mdx.matchAll(/<Term id="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(usedIds.length > 0, "lesson marks some incidental jargon with <Term>");
  for (const id of usedIds) assert.ok(definedIds.has(id), `<Term> id "${id}" has no glossary entry`);
});

test("evidence ledger resolves every claim and conflict, with only non-blocking uncertainties", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 7);
  assert.equal(ledger.slug, "wallets-keys-and-testnet");
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
});

test("independent WASM verifier authenticates the documented public derivation paths", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ derivationPaths: documentedDerivationPaths })}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    testnetPath: "m/44'/1'/0'/0/0",
    mainnetPath: "m/44'/5'/0'/0/0",
    testnetCoinType: 1,
    mainnetCoinType: 5,
  });
});

test("independent verifier rejects fields beyond public learner output", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      derivationPaths: documentedDerivationPaths,
      mnemonicOrKey: "not-accepted",
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /derivationPaths is the only accepted public field/);
});

test("independent verifier rejects a derivation path with the wrong coin type", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      derivationPaths: {
        testnet: "m/44'/5'/0'/0/0",
        mainnet: "m/44'/5'/0'/0/0",
      },
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /testnet derivation path must be m\/44'\/1'\/0'\/0\/0/);
});
