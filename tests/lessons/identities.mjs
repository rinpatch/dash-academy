import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/identities.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/identities.json", import.meta.url);

test("lesson follows the module 3 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Identities/);
  assert.match(mdx, /module: 3/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /prerequisites: \[2\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="identities"/);
  assert.match(mdx, /## What you accomplished/);
});

test("lesson covers object boundaries, scoped keys, credits, and fees", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "Core wallet",
    "Core address",
    "Platform address",
    "Platform identity",
    "master-level authentication key",
    "Transfer",
    "1 duff = 1,000 credits",
    "Storage fees",
    "Processing fees",
    "top up",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("evidence ledger resolves every claim and conflict", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 3);
  assert.equal(ledger.slug, "identities");
  assert.equal(ledger.uncertainties.length, 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
});
