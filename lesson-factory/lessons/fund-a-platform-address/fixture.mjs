import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/fund-a-platform-address.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

if (process.argv.includes("--live-protocol")) process.exitCode = await runLiveProtocol();
else registerTests();

function registerTests() {
  test("lesson follows the module 9 contract", async () => {
    const mdx = await readFile(mdxUrl, "utf8");
    for (const required of [
      "module: 9", "tier: sdk", "estimatedMinutes: 20", "exp: 175",
      "verification: testnet", "prerequisites: [8]", 'challengeId="fund-a-platform-address"',
      'operation="platform-address-funded"', "derivationPathBip44Testnet", "toBech32m(network)",
      "tdash1", "sdk.addresses.get(address)", "39,500,000", "Core-to-Platform funding path",
    ]) assert.ok(mdx.includes(required), `missing lesson requirement: ${required}`);
    assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
  });

  test("lesson never prints or submits the mnemonic", async () => {
    const mdx = await readFile(mdxUrl, "utf8");
    assert.doesNotMatch(mdx, /console\.log\([^\n]*mnemonic/);
    assert.match(mdx, /flag: 'wx'/);
    assert.match(mdx, /mode: 0o600/);
  });

  test("pinned SDK derives a normalized testnet Platform address", async () => {
    const { PlatformAddressSigner, PrivateKey, wallet } = await import("@dashevo/evo-sdk");
    const mnemonic = await wallet.generateMnemonic();
    const path = (await wallet.derivationPathBip44Testnet(0, 0, 0)).path;
    const key = await wallet.deriveKeyFromSeedWithPath({ mnemonic, path, network: "testnet" });
    const signer = new PlatformAddressSigner();
    const address = signer.addKey(PrivateKey.fromWIF(key.toObject().privateKeyWif)).toBech32m("testnet");
    assert.match(address, /^tdash1/);
    verifyPublicAddress(address);
  });

  test("evidence ledger resolves its claims", async () => {
    const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
    const sources = new Set(ledger.sources.map((source) => source.id));
    assert.equal(ledger.module, 9);
    assert.equal(ledger.slug, "fund-a-platform-address");
    assert.equal(ledger.uncertainties.length, 0);
    for (const claim of ledger.claims) for (const source of claim.sourceIds) assert.ok(sources.has(source));
    assert.ok(ledger.conflicts.every((conflict) => conflict.status === "resolved"));
  });

  test("verifier rejects any field beyond the public address", async () => {
    const address = await deriveAddress();
    const result = spawnSync(process.execPath, [verifierUrl.pathname], {
      encoding: "utf8", input: `${JSON.stringify({ address, mnemonic: "not accepted" })}\n`,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /address is the only accepted public field/);
  });
}

async function deriveAddress() {
  const { PlatformAddressSigner, PrivateKey, wallet } = await import("@dashevo/evo-sdk");
  const mnemonic = await wallet.generateMnemonic();
  const path = (await wallet.derivationPathBip44Testnet(0, 0, 0)).path;
  const key = await wallet.deriveKeyFromSeedWithPath({ mnemonic, path, network: "testnet" });
  return new PlatformAddressSigner().addKey(PrivateKey.fromWIF(key.toObject().privateKeyWif)).toBech32m("testnet");
}

function verifyPublicAddress(address) {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8", input: `${JSON.stringify({ address })}\n`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { type: "verification", status: "passed", address });
}

async function runLiveProtocol() {
  const address = await deriveAddress();
  process.stdout.write(`${JSON.stringify({
    type: "funding-request", operation: "platform-address-funded", address, amountCredits: "40000000",
  })}\n`);

  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let funding;
  try { funding = JSON.parse(raw.trim()); } catch { return 1; }
  if (funding.type !== "funding-result" || funding.status !== "funded") return 1;

  process.stdout.write(`${JSON.stringify({ type: "result", status: "passed", publicResult: { address } })}\n`);
  return 0;
}
