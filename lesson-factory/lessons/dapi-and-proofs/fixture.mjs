import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/dapi-and-proofs.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const documentedProofInfoFields = [
  "grovedbProof",
  "quorumHash",
  "signature",
  "round",
  "blockIdHash",
  "quorumType",
];

test("lesson follows the module 5 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: DAPI and Proofs/);
  assert.match(mdx, /description: Understand what answered your first request, and why you can trust the answer\./);
  assert.match(mdx, /module: 5/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 15/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[4\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="dapi-and-proofs"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers every mustCover item in its own terms", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "decentralized API",
    "no single point of failure",
    "masternode",
    "evonode",
    "TLS",
    "Dash Core",
    "Dash Platform",
    "layer 1",
    "layer 2",
    "getBestBlockHash",
    "getBlockHash",
    "endpoint selection",
    "seed node",
    "testnet",
    "mainnet",
    "local",
    "seed-1.testnet.networks.dash.org",
    "1443",
    "ban",
    "withAddresses",
    "state proof",
    "GroveDB",
    "AppHash",
    "inclusion proof",
    "non-inclusion proof",
    "light client",
    "Long-Living Masternode Quorum",
    "trusted mode",
    "testnetTrusted()",
    "ProofInfo",
    "verification boundary",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("the completing quiz checks decentralization, the two layers, selection, proofs, and the trust boundary", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["dapi-and-proofs"]);
  assert.match(mdx, /id: "why-decentralized"/);
  assert.match(mdx, /id: "core-vs-platform"/);
  assert.match(mdx, /id: "endpoint-selection"/);
  assert.match(mdx, /id: "state-proof-anchor"/);
  assert.match(mdx, /id: "trusted-mode-boundary"/);
  assert.match(mdx, /passingScore=\{4\}/);
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

  for (const id of ["state-proof", "light-client"]) {
    assert.ok(definedIds.has(id), `expected glossary entry "${id}"`);
  }
});

test("evidence ledger resolves every claim, conflict, and non-blocking uncertainty", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 5);
  assert.equal(ledger.slug, "dapi-and-proofs");

  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
  const versionConflict = ledger.conflicts.find(({ id }) => id === "X1");
  assert.equal(versionConflict?.status, "resolved");

  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }

  assert.ok(ledger.uncertainties.length > 0, "records the resolved SDK-surface and glossary uncertainties");
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
    assert.ok(uncertainty.resolution, `${uncertainty.id} has no resolution`);
  }

  for (const example of ledger.examples) {
    for (const sourceId of example.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
});

test("independent WASM verifier confirms the documented ProofInfo field shape", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ proofInfoFields: documentedProofInfoFields })}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    proofInfoFields: [
      "blockIdHash",
      "grovedbProof",
      "quorumHash",
      "quorumType",
      "round",
      "signature",
    ],
  });
});

test("independent verifier rejects fields beyond public learner output", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      proofInfoFields: documentedProofInfoFields,
      signingSecret: "not-accepted",
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /proofInfoFields is the only accepted public field/);
});

test("independent verifier rejects a proof field shape that does not match the SDK", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      proofInfoFields: ["rootTreeProof", "storeTreeProofs", "signatureLlmqHash", "signature"],
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match the WASM ProofInfo shape/);
});
