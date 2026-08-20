import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/what-is-dash.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/what-is-dash.json", import.meta.url);

test("lesson follows the module 1 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: What is Dash\?/);
  assert.match(mdx, /description: "Start from zero: what a blockchain is, and what makes Dash different\."/);
  assert.match(mdx, /module: 1/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="what-is-dash"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers each mustCover item in its own terms", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "append-only log",
    "tamper-evident",
    "hash",
    "double spend",
    "private key",
    "public key",
    "address",
    "100,000,000 duffs",
    "No single point of failure",
    "Nobody can shut it down",
    "digital cash",
    "2.6 minutes",
    "masternode",
    "1,000 DASH",
    "about a second",
    "Dash Core",
    "Dash Platform",
    "Drive",
    "DAPI",
    "4,000 DASH",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("lesson stays inside the mustNotCover boundary", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const forbidden of [
    "InstantSend",
    "ChainLock",
    "ChainLocks",
    "Tenderdash",
    "LLMQ",
    "Quorum",
    "quorum",
    "data contract",
    "identity",
    "document",
  ]) {
    assert.ok(!mdx.includes(forbidden), `lesson must not cover: ${forbidden}`);
  }
});

test("the completing quiz checks the chain, addresses, double spend, decentralization, masternodes, and the two jobs", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["what-is-dash"]);
  assert.match(mdx, /id: "what-a-blockchain-is"/);
  assert.match(mdx, /id: "give-an-address"/);
  assert.match(mdx, /id: "no-double-spend"/);
  assert.match(mdx, /id: "why-decentralize"/);
  assert.match(mdx, /id: "masternode-enables"/);
  assert.match(mdx, /id: "which-layer-data"/);
  assert.match(mdx, /passingScore=\{5\}/);
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

test("evidence ledger resolves every claim and non-blocking uncertainty", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 1);
  assert.equal(ledger.slug, "what-is-dash");
  assert.ok(ledger.conflicts.length === 0);
  assert.equal(ledger.executableExamples.length, 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
});