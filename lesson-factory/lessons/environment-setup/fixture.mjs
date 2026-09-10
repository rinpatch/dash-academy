import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EvoSDK } from "@dashevo/evo-sdk";

const mdxUrl = new URL("../../../content/academy/environment-setup.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);

test("lesson follows the Environment setup manifest row", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  for (const expected of [
    "title: Environment setup",
    'description: "Install the SDK, connect to Dash Platform, and make a verified read."',
    "module: 5",
    "tier: sdk",
    "estimatedMinutes: 18",
    "exp: 150",
    "verification: none",
    "prerequisites: [4]",
  ]) assert.ok(mdx.includes(expected), `missing frontmatter: ${expected}`);
  assert.doesNotMatch(mdx, /<TestnetVerifier|<LessonQuiz/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("pinned SDK exposes every API used by connect.mjs", () => {
  assert.equal(typeof EvoSDK.testnetTrusted, "function");
  const sdk = EvoSDK.testnetTrusted();
  assert.equal(sdk.isConnected, false);
  assert.equal(typeof sdk.connect, "function");
  assert.equal(typeof sdk.system.status, "function");
});

test("lesson installs the pin and performs a status read after connecting", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  assert.match(mdx, /npm install @dashevo\/evo-sdk@4\.1\.1/);
  assert.match(mdx, /const sdk = EvoSDK\.testnetTrusted\(\);/);
  assert.match(mdx, /await sdk\.connect\(\);/);
  assert.match(mdx, /await sdk\.system\.status\(\);/);
  assert.match(mdx, /snapshot\.network\.chainId/);
  assert.match(mdx, /snapshot\.chain\.latestBlockHeight/);
  assert.doesNotMatch(mdx, /mainnetTrusted|withAddresses|WithProof/);
});

test("evidence ledger maps every required concept", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));
  assert.equal(ledger.module, 5);
  assert.equal(ledger.slug, "environment-setup");
  assert.equal(ledger.uncertainties.length, 0);
  assert.equal(ledger.coverageMap.length, 3);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId), `missing source ${sourceId}`);
  }
});
