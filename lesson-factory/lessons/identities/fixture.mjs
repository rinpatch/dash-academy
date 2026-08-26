import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mdxUrl = new URL("../../../content/academy/identities.mdx", import.meta.url);
const ledgerUrl = new URL("./evidence.json", import.meta.url);
const verifierUrl = new URL("./verify.mjs", import.meta.url);

const documentedPublicKeySpecs = [
  { keyId: 0, purpose: "AUTHENTICATION", securityLevel: "MASTER" },
  { keyId: 1, purpose: "AUTHENTICATION", securityLevel: "CRITICAL" },
  { keyId: 2, purpose: "AUTHENTICATION", securityLevel: "HIGH" },
  { keyId: 3, purpose: "TRANSFER", securityLevel: "CRITICAL" },
  { keyId: 4, purpose: "ENCRYPTION", securityLevel: "MEDIUM" },
  { keyId: 5, purpose: "DECRYPTION", securityLevel: "MEDIUM" },
];

test("lesson follows the module 6 concept contract", async () => {
  const mdx = await readFile(mdxUrl, "utf8");

  assert.match(mdx, /title: Identities/);
  assert.match(mdx, /description: Understand Platform identities, keys, credits, and their relationship to wallets\./);
  assert.match(mdx, /module: 6/);
  assert.match(mdx, /tier: concepts/);
  assert.match(mdx, /estimatedMinutes: 12/);
  assert.match(mdx, /exp: 100/);
  assert.match(mdx, /verification: quiz/);
  assert.match(mdx, /prerequisites: \[5\]/);
  assert.match(mdx, /## Checkpoint/);
  assert.match(mdx, /challengeId="identities"/);
  assert.match(mdx, /## What you accomplished/);
  assert.doesNotMatch(mdx.replace(/^---[\s\S]*?---/, ""), /^# /m);
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

test("the completing quiz checks ownership, key scope, and the fee model", async () => {
  const mdx = await readFile(mdxUrl, "utf8");
  const challengeIds = [...mdx.matchAll(/challengeId="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(challengeIds, ["identities"]);
  assert.match(mdx, /id: "owns-data"/);
  assert.match(mdx, /id: "platform-address"/);
  assert.match(mdx, /id: "master-key"/);
  assert.match(mdx, /id: "credit-conversion"/);
  assert.match(mdx, /id: "fees-split"/);
  assert.match(mdx, /passingScore=\{4\}/);
});

test("the documented key model resolves to valid purposes and levels with one master key", async () => {
  const { default: init, Identity, Identifier, IdentityPublicKeyInCreation, KeyType, Purpose, SecurityLevel } =
    await import("@dashevo/wasm-sdk");
  await init();

  const identifier = Identifier.fromBase58("6YfP6tT9AK8HPVXMK7CQrhpc8VMg7frjEnXinSPvUmZC");
  const identity = new Identity(identifier);

  try {
    for (const spec of documentedPublicKeySpecs) {
      assert.notEqual(Purpose[spec.purpose], undefined, `purpose "${spec.purpose}" is unknown`);
      assert.notEqual(SecurityLevel[spec.securityLevel], undefined, `level "${spec.securityLevel}" is unknown`);

      const key = new IdentityPublicKeyInCreation({
        keyId: spec.keyId,
        purpose: Purpose[spec.purpose],
        securityLevel: SecurityLevel[spec.securityLevel],
        keyType: KeyType.ECDSA_SECP256K1,
        data: new Uint8Array(33).fill(spec.keyId + 1),
      });
      identity.addPublicKey(key.toIdentityPublicKey());
      key.free();
    }

    const masterKeys = identity.publicKeys.filter((key) => key.isMaster);
    assert.equal(masterKeys.length, 1, "exactly one master-level authentication key");
    assert.equal(Purpose[masterKeys[0].purposeNumber], "AUTHENTICATION");
    assert.equal(SecurityLevel[masterKeys[0].securityLevelNumber], "MASTER");

    const purposes = new Set(identity.publicKeys.map((key) => Purpose[key.purposeNumber]));
    const levels = new Set(identity.publicKeys.map((key) => SecurityLevel[key.securityLevelNumber]));
    assert.deepEqual([...purposes].sort(), ["AUTHENTICATION", "DECRYPTION", "ENCRYPTION", "TRANSFER"]);
    assert.deepEqual([...levels].sort(), ["CRITICAL", "HIGH", "MASTER", "MEDIUM"]);
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

  assert.equal(ledger.module, 6);
  assert.equal(ledger.slug, "identities");
  assert.equal(ledger.uncertainties.length, 0);
  for (const claim of ledger.claims) {
    assert.ok(claim.sourceIds.length > 0, `${claim.id} has no evidence`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId));
  }
  assert.ok(ledger.conflicts.every(({ status }) => status === "resolved"));
});

test("independent WASM verifier authenticates the documented identity key model", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ identityKeys: documentedPublicKeySpecs })}\n`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    type: "verification",
    status: "passed",
    keyCount: 6,
    masterKeyId: 0,
    purposes: ["AUTHENTICATION", "DECRYPTION", "ENCRYPTION", "TRANSFER"],
    securityLevels: ["CRITICAL", "HIGH", "MASTER", "MEDIUM"],
  });
});

test("independent verifier rejects fields beyond public learner output", () => {
  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({
      identityKeys: documentedPublicKeySpecs,
      mnemonicOrKey: "not-accepted",
    })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identityKeys is the only accepted public field/);
});

test("independent verifier rejects a key model without exactly one master key", () => {
  const noMaster = documentedPublicKeySpecs.map(({ keyId, purpose, securityLevel }) => ({
    keyId,
    purpose,
    securityLevel: securityLevel === "MASTER" ? "HIGH" : securityLevel,
  }));

  const result = spawnSync(process.execPath, [verifierUrl.pathname], {
    encoding: "utf8",
    input: `${JSON.stringify({ identityKeys: noMaster })}\n`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected exactly one master-level authentication key/);
});
