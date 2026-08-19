import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/proofs.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/proofs.json", import.meta.url);

test("lesson follows the module 7 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Proofs/);
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
});

test("lesson covers state proofs, light-client trust, and verification boundaries", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "GroveDB proof",
    "AppHash",
    "Long-Living Masternode Quorum",
    "Inclusion",
    "Non-inclusion",
    "light client",
    "authenticated consensus anchor",
    "TLS and state proofs solve different problems",
    "Consensus is not real-world truth",
    "Failure means unverified",
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
