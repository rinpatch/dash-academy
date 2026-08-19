import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/proofs.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/proofs.json", import.meta.url);
const verifierUrl = new URL("./proofs.verify.mjs", import.meta.url);

const documentedProofInfoFields = [
  "grovedbProof",
  "quorumHash",
  "signature",
  "round",
  "blockIdHash",
  "quorumType",
];

test("lesson follows the module 7 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Proofs/);
  assert.match(mdx, /description: Verify Platform responses instead of trusting a single server\./);
  assert.match(mdx, /module: 7/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[6\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="proofs"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers state proofs, light-client trust, and verification boundaries", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "state proof",
    "GroveDB",
    "AppHash",
    "inclusion proof",
    "non-inclusion proof",
    "light client",
    "Long-Living Masternode Quorum",
    "authenticated consensus anchor",
    "trusted context",
    "TLS and state proofs solve different problems",
    "Consensus is not real-world truth",
    "Failure means unverified",
    "testnetTrusted()",
    "ProofInfo",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("the one completing quiz checks proof chain, trust, and failure handling", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["proofs"]);
  assert.match(mdx, /id: "proof-chain"/);
  assert.match(mdx, /id: "non-inclusion"/);
  assert.match(mdx, /id: "trust-boundary"/);
  assert.match(mdx, /id: "failed-verification"/);
  assert.match(mdx, /passingScore=\{3\}/);
});

test("every <Term> id resolves to a glossary entry", async () => {
  const [mdx, glossarySource] = await Promise.all([
    readFile(mdxUrl, "utf8"),
    readFile(new URL("../../lib/glossary.ts", import.meta.url), "utf8"),
  ]);

  const body = glossarySource.slice(glossarySource.indexOf("GLOSSARY: Record<string, GlossaryEntry> = {"));
  const definedIds = new Set(
    [...body.matchAll(/^ {2}"?([a-z0-9-]+)"?: \{$/gm)].map((match) => match[1]),
  );

  const usedIds = [...mdx.matchAll(/<Term id="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(usedIds.length > 0, "lesson marks some incidental jargon with <Term>");
  for (const id of usedIds) assert.ok(definedIds.has(id), `<Term> id "${id}" has no glossary entry`);
});

test("evidence ledger supports every claim and resolves the version conflict", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 7);
  assert.equal(ledger.slug, "proofs");
  assert.equal(ledger.examples.length, 0);
  assert.ok(ledger.uncertainties.some(({ blocking }) => blocking === false));
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  const proofShapeConflict = ledger.conflicts.find(({ id }) => id === "X1");
  assert.equal(proofShapeConflict?.status, "resolved");
  assert.match(proofShapeConflict.resolution, /wasm-sdk 4\.1\.1 declaration is authoritative/);
  assert.match(proofShapeConflict.resolution, /Platform docs 3\.1\.0 support only the conceptual proof semantics/);
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