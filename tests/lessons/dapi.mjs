import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/dapi.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/dapi.json", import.meta.url);

test("lesson follows the module 6 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: DAPI/);
  assert.match(mdx, /description: Understand Dash's decentralized API and how clients use it\./);
  assert.match(mdx, /module: 6/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 10/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[5\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="dapi"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers the decentralized API, Core and Platform access, and endpoint selection in its own terms", async () => {
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
    "getIdentity",
    "getDataContract",
    "getDocuments",
    "broadcastStateTransition",
    "waitForStateTransitionResult",
    "endpoint selection",
    "network name",
    "testnet",
    "mainnet",
    "local",
    "seed-1.testnet.networks.dash.org",
    "1443",
    "fall back",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("the completing quiz checks decentralization, the two layers, endpoint families, and instance selection", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["dapi"]);
  assert.match(mdx, /id: "why-decentralized"/);
  assert.match(mdx, /id: "two-layers"/);
  assert.match(mdx, /id: "jsonrpc-vs-grpc"/);
  assert.match(mdx, /id: "which-instance"/);
  assert.match(mdx, /id: "fallback"/);
  assert.match(mdx, /passingScore=\{4\}/);
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

test("evidence ledger resolves every claim, conflict, and non-blocking uncertainty", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 6);
  assert.equal(ledger.slug, "dapi");
  assert.equal(ledger.examples.length, 0);
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  assert.ok(ledger.uncertainties.length > 0, "records the resolved endpoint-selection uncertainties");
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
});