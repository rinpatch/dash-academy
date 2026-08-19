import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/why-build-on-dash.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/why-build-on-dash.json", import.meta.url);

test("lesson follows the module 2 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Why build on Dash\?/);
  assert.match(mdx, /description: Decide when Dash is a good fit for an application\./);
  assert.match(mdx, /module: 2/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[1\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="why-build-on-dash"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers each mustCover item in its own terms", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "fit screen",
    "strong fit",
    "poor fit",
    "Payments and tokens",
    "about a second",
    "data contract",
    "Usernames and NFTs",
    "DPNS",
    "identity",
    "document-based NFTs",
    "Dash versus Credits",
    "1,000 credits per duff",
    "100,000,000,000",
    "Privacy",
    "CoinJoin",
    "zero-knowledge",
    "Orchard/Halo2",
    "The DAO",
    "masternode",
    "treasury",
    "Turing-complete",
    "smart contract",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("the completing quiz builds a fit decision across all six mustCover areas", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["why-build-on-dash"]);
  assert.match(mdx, /id: "fit-decision"/);
  assert.match(mdx, /id: "payments-tokens"/);
  assert.match(mdx, /id: "usernames-nfts"/);
  assert.match(mdx, /id: "dash-vs-credits"/);
  assert.match(mdx, /id: "privacy"/);
  assert.match(mdx, /id: "dao"/);
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

  assert.equal(ledger.module, 2);
  assert.equal(ledger.slug, "why-build-on-dash");
  assert.ok(ledger.conflicts.length === 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
});