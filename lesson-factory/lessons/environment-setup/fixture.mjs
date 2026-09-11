import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EvoSDK } from "@dashevo/evo-sdk";

const mdxUrl = new URL("../../../content/academy/environment-setup.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

if (process.argv.includes("--live-protocol")) process.exitCode = await runLiveProtocol();
else registerTests();

function registerTests() {

test("lesson follows the Environment setup manifest row", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  for (const expected of [
    "title: Environment setup",
    'description: "Install the SDK, connect to Dash Platform, and make a verified read."',
    "module: 5",
    "tier: sdk",
    "estimatedMinutes: 18",
    "exp: 150",
    "verification: testnet",
    "prerequisites: [4]",
  ]) assert.ok(mdx.includes(expected), `missing frontmatter: ${expected}`);
  assert.match(mdx, /<TestnetVerifier/);
  assert.match(mdx, /challengeId="environment-setup"/);
  assert.match(mdx, /operation="platform-height-observed"/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
});

test("lesson compares the SDK response with the testnet Platform Explorer", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  assert.match(mdx, /https:\/\/testnet\.platform-explorer\.com\//);
  assert.match(mdx, /Compare that height with the number printed by `connect\.mjs`/);
});

test("pinned SDK exposes every API used by connect.mjs", () => {
  assert.equal(typeof EvoSDK.testnetTrusted, "function");
  const sdk = EvoSDK.testnetTrusted();
  assert.equal(sdk.isConnected, false);
  assert.equal(typeof sdk.connect, "function");
  assert.equal(typeof sdk.system.status, "function");
});

test("independent verifier accepts only one public height", () => {
  const accepted = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ height: "12345" })}\n`,
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.deepEqual(JSON.parse(accepted.stdout), {
    type: "verification", status: "passed", height: "12345",
  });

  const rejected = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ height: "12345", secret: "not accepted" })}\n`,
  });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /height is the only accepted public field/);
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
}

async function runLiveProtocol() {
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();
  const status = await sdk.system.status();
  const height = String(status.toJSON().chain.latestBlockHeight);

  process.stdout.write(`${JSON.stringify({
    type: "funding-request", operation: "platform-height-observed", address: "read-only", amountCredits: "0",
  })}\n`);

  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let funding;
  try { funding = JSON.parse(raw.trim()); } catch { return 1; }
  if (funding.type !== "funding-result" || funding.status !== "funded") return 1;

  process.stdout.write(`${JSON.stringify({ type: "result", status: "passed", publicResult: { height } })}\n`);
  return 0;
}
