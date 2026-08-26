import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/documents.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const DOCUMENT = {
  $id: "6NsbpUBZUnyArsmWozxhuGdXTBNVE5BMyRh6hsowg8HY",
  $type: "note",
  $dataContractId: "2cJrFFWZNB1QBP2U9pzAwxLqbdnD2ZiA4j9ByyaVQPmB",
  $ownerId: "6YfP6tT9AK8HPVXMK7CQrhpc8VMg7frjEnXinSPvUmZC",
  $revision: "1",
  $entropy: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
};

test("lesson follows the module 13 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Documents/);
  assert.match(mdx, /description: Understand the lifecycle, ownership, and revision of Platform documents\./);
  assert.match(mdx, /module: 13/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 14/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[12\]/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="documents"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers the read/write lifecycle, ownership, revisions, and delete refunds", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "$id",
    "$type",
    "$revision",
    "$dataContractId",
    "$ownerId",
    "entropy",
    "sdk.documents.query",
    "Create",
    "Replace",
    "Delete",
    "transfer",
    "purchase",
    "update price",
    "Batch",
    "optimistic concurrency",
    "documentsMutable",
    "revision + 1n",
    "storage refund",
    "50-year",
    "Processing fees are never refunded.",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("the completing quiz checks reads, ownership, revisions, immutability, and refunds", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["documents"]);
  assert.match(mdx, /id: "read-vs-write"/);
  assert.match(mdx, /id: "owns-edit"/);
  assert.match(mdx, /id: "revision-bump"/);
  assert.match(mdx, /id: "immutable-type"/);
  assert.match(mdx, /id: "delete-refund"/);
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
});

test("evidence ledger resolves every claim and non-blocking uncertainty", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 13);
  assert.equal(ledger.slug, "documents");
  assert.equal(ledger.examples.length, 0);
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
  assert.ok(ledger.uncertainties.length > 0, "delete-refund phrasing was a recorded uncertainty");
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
});

test("independent WASM verifier reconstructs the documented document ID and revision", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ document: DOCUMENT })}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    documentId: "6NsbpUBZUnyArsmWozxhuGdXTBNVE5BMyRh6hsowg8HY",
    revision: "1",
  });
});

test("independent verifier rejects fields beyond public learner output", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      document: DOCUMENT,
      signingSecret: "not-accepted",
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /document is the only accepted public field/);
});

test("independent verifier rejects a document ID that was not derived from its base fields", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      document: {
        ...DOCUMENT,
        $id: "4mWnFcDDzCpeLExJqE8v7pfN4EERC8NE2xn4hw3VKriU",
      },
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /derived document id does not match \$id/);
});

test("independent verifier rejects a non-positive revision", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      document: { ...DOCUMENT, $revision: "0" },
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /document\.\$revision must be an integer of at least 1/);
});
