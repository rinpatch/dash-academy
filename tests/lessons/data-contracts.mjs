import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../content/academy/data-contracts.mdx", import.meta.url);
const ledgerUrl = new URL("../../lesson-sources/data-contracts.json", import.meta.url);
const verifierUrl = new URL("./data-contracts.verify.mjs", import.meta.url);
const MAX_INDEXED_STRING_LENGTH = 63;

const documentedPublicSchemas = {
  post: {
    type: "object",
    properties: {
      authorId: { type: "string", position: 0, maxLength: 44 },
      slug: { type: "string", position: 1, maxLength: 63 },
      title: { type: "string", position: 2, maxLength: 120 },
      publishedAt: { type: "integer", position: 3, minimum: 0 },
    },
    required: ["authorId", "slug", "title", "publishedAt"],
    additionalProperties: false,
    indices: [
      {
        name: "byAuthorAndPublishedAt",
        properties: [{ authorId: "asc" }, { publishedAt: "asc" }],
        unique: false,
      },
      {
        name: "uniqueSlug",
        properties: [{ slug: "asc" }],
        unique: true,
      },
    ],
  },
};

test("lesson follows the module 11 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Data Contracts/);
  assert.match(mdx, /module: 11/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 14/);
  assert.match(mdx, /prerequisites: \[10\]/);
  assert.match(mdx, /## Learning objectives/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="data-contracts"/);
  assert.match(mdx, /## What you accomplished/);
  assert.match(mdx, /"slug": \{ "type": "string", "position": 1, "maxLength": 63 \}/);
});

test("lesson covers schemas, document types, indexes, durable decisions, and boundaries", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  for (const required of [
    "document type",
    "additionalProperties",
    "position",
    "required",
    "compound index",
    "unique index",
    "contract-time",
    "No developer-defined triggers",
    "hard-coded triggers",
    "No server-side joins",
    "dataContractId",
    "documentTypeName",
  ]) {
    assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
  }
});

test("evidence ledger resolves every claim", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));

  assert.equal(ledger.module, 11);
  assert.equal(ledger.slug, "data-contracts");
  assert.equal(ledger.uncertainties.length, 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
});

test("all indexed string fields respect Dash's documented length limit", () => {
  for (const [documentType, schema] of Object.entries(documentedPublicSchemas)) {
    for (const index of schema.indices) {
      for (const indexedProperty of index.properties) {
        const propertyName = Object.keys(indexedProperty)[0];
        const propertySchema = schema.properties[propertyName];

        if (propertySchema.type === "string") {
          assert.ok(
            Number.isInteger(propertySchema.maxLength)
              && propertySchema.maxLength <= MAX_INDEXED_STRING_LENGTH,
            `${documentType}.${propertyName} exceeds the ${MAX_INDEXED_STRING_LENGTH}-character indexed-string limit`,
          );
        }
      }
    }
  }
});

test("independent WASM verifier constructs the documented public contract model", () => {
  const publicOutput = { documentSchemas: documentedPublicSchemas };
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify(publicOutput)}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    documentTypes: ["post"],
    indexes: ["byAuthorAndPublishedAt", "uniqueSlug"],
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
  invalidSchemas.post.properties.title.type = "unsupported-type";
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ documentSchemas: invalidSchemas })}\n`,
  });

  assert.notEqual(result.status, 0);
});
