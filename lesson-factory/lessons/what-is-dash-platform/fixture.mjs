import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/what-is-dash-platform.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const documentedPublicSchemas = {
  note: {
    type: "object",
    properties: {
      message: { type: "string", position: 0 },
    },
    required: ["message"],
    additionalProperties: false,
  },
};

test("lesson follows the module 2 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: What is Dash Platform\?/);
  assert.match(mdx, /description: See what Dash Platform lets you build, and what you will build here\./);
  assert.match(mdx, /module: 2/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[1\]/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="what-is-dash-platform"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson covers each mustCover item in its own terms", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "Dash Core",
    "Dash Platform",
    "data contract",
    "JSON Schema",
    "MongoDB",
    "document",
    "state transition",
    "Drive",
    "DAPI",
    "GroveDB",
    "additionalProperties",
    "DPNS",
    "identity",
    "fungible",
    "non-fungible",
    "DashPay",
    "Dashnote",
    "DashMint Lab",
    "testnet",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("lesson stays inside the mustNotCover boundary", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const forbidden of ["InstantSend", "ChainLock", "ChainLocks", "Tenderdash", "LLMQ", "Quorum", "quorum", "masternode"]) {
    assert.ok(!mdx.includes(forbidden), `lesson must not cover: ${forbidden}`);
  }
});

test("the completing quiz checks layer split, storage, change mechanism, buildables, and the course arc", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["what-is-dash-platform"]);
  assert.match(mdx, /id: "layer-split"/);
  assert.match(mdx, /id: "schema-not-code"/);
  assert.match(mdx, /id: "change-mechanism"/);
  assert.match(mdx, /id: "buildables"/);
  assert.match(mdx, /id: "course-arc"/);
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

  assert.equal(ledger.module, 2);
  assert.equal(ledger.slug, "what-is-dash-platform");
  assert.equal(ledger.apiExamples.length, 0);
  assert.ok(ledger.conflicts.length === 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  for (const uncertainty of ledger.uncertainties) {
    assert.equal(uncertainty.blocking, false, `${uncertainty.id} is unresolved`);
  }
});

test("independent WASM verifier constructs the documented public schema model", () => {
  const publicOutput = { documentSchemas: documentedPublicSchemas };
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify(publicOutput)}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    documentTypes: ["note"],
  });
});

test("independent verifier rejects fields beyond public learner output", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      documentSchemas: documentedPublicSchemas,
      signingSecret: "not-accepted",
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /documentSchemas is the only accepted public field/);
});

test("independent verifier rejects an invalid Dash schema", () => {
  const invalidSchemas = structuredClone(documentedPublicSchemas);
  invalidSchemas.note.properties.message.type = "unsupported-type";

  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ documentSchemas: invalidSchemas })}\n`,
  });

  assert.notEqual(result.status, 0);
});
