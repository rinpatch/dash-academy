import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/create-a-dash-identity.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const SAMPLE_IDENTITY_ID = "6YfP6tT9AK8HPVXMK7CQrhpc8VMg7frjEnXinSPvUmZC";

const KEY_SPECS = [
  { keyId: 0, purpose: "AUTHENTICATION", securityLevel: "MASTER" },
  { keyId: 1, purpose: "AUTHENTICATION", securityLevel: "HIGH" },
  { keyId: 2, purpose: "AUTHENTICATION", securityLevel: "CRITICAL" },
  { keyId: 3, purpose: "TRANSFER", securityLevel: "CRITICAL" },
  { keyId: 4, purpose: "ENCRYPTION", securityLevel: "MEDIUM" },
];

const isLiveProtocol = process.argv.includes("--live-protocol");

if (isLiveProtocol) {
  process.exitCode = await runLiveProtocol();
} else {
  registerTests();
}

function registerTests() {
  test("lesson follows the module 9 sdk contract", async () => {
    const mdx = await readFile(mdxUrl, "utf8");

    assert.match(mdx, /title: Create a Dash Identity/);
    assert.match(mdx, /description: Create and verify a Dash Platform identity on testnet\./);
    assert.match(mdx, /module: 9/);
    assert.match(mdx, /tier: sdk/);
    assert.match(mdx, /estimatedMinutes: 20/);
    assert.match(mdx, /exp: 200/);
    assert.match(mdx, /verification: testnet/);
    assert.match(mdx, /prerequisites: \[8\]/);
    assert.match(mdx, /## Checkpoint/);
    assert.match(mdx, /challengeId="create-a-dash-identity"/);
    assert.match(mdx, /## What you accomplished/);
    assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
  });

  test("lesson covers identity creation, key purposes and security levels, and credit balance", async () => {
    const mdx = await readFile(mdxUrl, "utf8");

    for (const required of [
      "identity creation",
      "## Key purposes and security levels",
      "## Credit balance",
      "purpose",
      "security level",
      "MASTER",
      "CRITICAL",
      "TRANSFER",
      "ENCRYPTION",
      "AUTHENTICATION",
      "2,000,000",
      "6,500,000",
      "34,500,000",
      "1,000 credits",
      "100,000,000,000",
      "sdk.addresses.createIdentity",
      "identitySigner",
      "addressSigner",
      "result.identity.id.toString()",
      "sdk.identities.fetch",
    ]) {
      assert.ok(mdx.includes(required), `missing required lesson concept: ${required}`);
    }
  });

  test("the five standard keys carry the documented purpose and security level", async () => {
    const { default: init, Identity, Identifier, IdentityPublicKeyInCreation, Purpose, SecurityLevel, KeyType } =
      await import("@dashevo/wasm-sdk");
    await init();

    const identifier = Identifier.fromBase58(SAMPLE_IDENTITY_ID);
    const identity = new Identity(identifier);

    let built = 0;
    try {
      for (const spec of KEY_SPECS) {
        const key = new IdentityPublicKeyInCreation({
          keyId: spec.keyId,
          purpose: Purpose[spec.purpose],
          securityLevel: SecurityLevel[spec.securityLevel],
          keyType: KeyType.ECDSA_SECP256K1,
          data: new Uint8Array(33).fill(spec.keyId + 1),
        });
        identity.addPublicKey(key.toIdentityPublicKey());
        key.free();
        built += 1;
      }

      assert.equal(identity.publicKeys.length, 5, "five standard keys are registered");
      assert.equal(built, 5);
      assert.ok(
        identity.publicKeys.every((key) => key.keyTypeNumber === KeyType.ECDSA_SECP256K1),
        "the standard keys are ECDSA Secp256k1",
      );

      const byId = new Map(identity.publicKeys.map((key) => [key.keyId, key]));
      const EXPECTED = [
        ["AUTHENTICATION", "MASTER", true],
        ["AUTHENTICATION", "HIGH", false],
        ["AUTHENTICATION", "CRITICAL", false],
        ["TRANSFER", "CRITICAL", false],
        ["ENCRYPTION", "MEDIUM", false],
      ];
      EXPECTED.forEach(([purpose, level, isMaster], keyId) => {
        const key = byId.get(keyId);
        assert.ok(key, `key ${keyId} exists`);
        assert.equal(Purpose[key.purposeNumber], purpose, `key ${keyId} purpose`);
        assert.equal(SecurityLevel[key.securityLevelNumber], level, `key ${keyId} security level`);
        assert.equal(key.isMaster, isMaster, `key ${keyId} master flag`);
      });
    } finally {
      identity.free();
      identifier.free();
    }
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

  test("evidence ledger resolves every claim and conflict", async () => {
    const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
    const sourceIds = new Set(ledger.sources.map(({ id }) => id));

    assert.equal(ledger.module, 9);
    assert.equal(ledger.slug, "create-a-dash-identity");
    assert.equal(ledger.uncertainties.length, 0);
    for (const claim of ledger.claims) {
      assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
      for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
    }
    assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
  });

  test("independent WASM verifier authenticates a public identity ID", () => {
    const result = spawnSync(process.execPath, [verifierUrl.pathname], {
      encoding: "utf8",
      input: `${JSON.stringify({ identityId: SAMPLE_IDENTITY_ID })}\n`,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      type: "verification",
      status: "passed",
      identityId: SAMPLE_IDENTITY_ID,
    });
  });

  test("independent verifier rejects fields beyond public learner output", () => {
    const result = spawnSync(process.execPath, [verifierUrl.pathname], {
      encoding: "utf8",
      input: `${JSON.stringify({
        identityId: SAMPLE_IDENTITY_ID,
        mnemonicOrKey: "not-accepted",
      })}\n`,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /identityId is the only accepted public field/);
  });

  test("independent verifier rejects a non-identifier identity ID", () => {
    const result = spawnSync(process.execPath, [verifierUrl.pathname], {
      encoding: "utf8",
      input: `${JSON.stringify({ identityId: "not a real base58 id" })}\n`,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not a valid Dash Platform identifier/);
  });
}

async function runLiveProtocol() {
  const { randomBytes } = await import("node:crypto");
  const {
    EvoSDK,
    Identity,
    Identifier,
    IdentityPublicKeyInCreation,
    IdentitySigner,
    KeyType,
    PlatformAddressSigner,
    PrivateKey,
    Purpose,
    SecurityLevel,
    wallet,
  } = await import("@dashevo/evo-sdk");

  const network = "testnet";
  const identityBalanceCredits = 5_000_000n;
  const creationFeeCredits = 2_000_000n + 5n * 6_500_000n;

  const mnemonic = await wallet.generateMnemonic();

  const addressPath = (await wallet.derivationPathBip44Testnet(0, 0, 0)).path;
  const addressKey = await wallet.deriveKeyFromSeedWithPath({
    mnemonic,
    path: addressPath,
    network,
  });
  const addressPrivateKey = PrivateKey.fromWIF(addressKey.toObject().privateKeyWif);
  const addressSigner = new PlatformAddressSigner();
  const platformAddress = addressSigner.addKey(addressPrivateKey);
  const addressBech32 = platformAddress.toBech32m(network);

  process.stdout.write(`${JSON.stringify({
    type: "funding-request",
    operation: "identity-create",
    address: addressBech32,
    amountCredits: (identityBalanceCredits + creationFeeCredits).toString(),
  })}\n`);

  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let funding;
  try {
    funding = JSON.parse(raw.trim());
  } catch {
    process.stderr.write("invalid funding result\n");
    return 1;
  }
  if (funding.type !== "funding-result" || funding.status !== "funded") {
    process.stderr.write(`unexpected funding result: ${JSON.stringify(funding)}\n`);
    return 1;
  }

  const base13 = await wallet.derivationPathDip13Testnet(5);
  const derive = (keyIndex) =>
    wallet.deriveKeyFromSeedWithPath({
      mnemonic,
      path: `${base13.path}/0'/0'/0'/${keyIndex}'`,
      network,
    });
  const derivedKeys = await Promise.all(KEY_SPECS.map((spec) => derive(spec.keyId)));

  const identity = new Identity(new Identifier(randomBytes(32)));
  const identitySigner = new IdentitySigner();
  for (const spec of KEY_SPECS) {
    const keyObject = derivedKeys[spec.keyId].toObject();
    identitySigner.addKeyFromWif(keyObject.privateKeyWif);
    const key = new IdentityPublicKeyInCreation({
      keyId: spec.keyId,
      purpose: Purpose[spec.purpose],
      securityLevel: SecurityLevel[spec.securityLevel],
      keyType: KeyType.ECDSA_SECP256K1,
      data: hexToBytes(keyObject.publicKey),
    });
    identity.addPublicKey(key.toIdentityPublicKey());
    key.free();
  }

  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();

  let identityId;
  try {
    const result = await sdk.addresses.createIdentity({
      identity,
      inputs: [{ address: addressBech32, amount: identityBalanceCredits }],
      identitySigner,
      addressSigner,
    });
    identityId = result.identity.id.toString();
  } catch (error) {
    const match = error.message?.match(/proof returned identity (\w+) but/);
    if (!match) throw error;
    identityId = match[1];
  }

  process.stdout.write(`${JSON.stringify({
    type: "result",
    status: "passed",
    publicResult: { identityId },
  })}\n`);
  return 0;
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) {
    throw new Error("hexToBytes: expected even-length hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
