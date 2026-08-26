import init, { Identity, Identifier, IdentityPublicKeyInCreation, KeyType, Purpose, SecurityLevel } from "@dashevo/wasm-sdk";

const PLACEHOLDER_ID = "6YfP6tT9AK8HPVXMK7CQrhpc8VMg7frjEnXinSPvUmZC";

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing public identityKeys");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing public identityKeys");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "identityKeys") {
  fail("identityKeys is the only accepted public field");
}

if (!Array.isArray(learnerOutput.identityKeys) || learnerOutput.identityKeys.length === 0) {
  fail("identityKeys must be a non-empty array of { keyId, purpose, securityLevel }");
}

await init();

const identifier = Identifier.fromBase58(PLACEHOLDER_ID);
const identity = new Identity(identifier);

let keyCount = 0;
try {
  for (const entry of learnerOutput.identityKeys) {
    if (
      !entry
      || typeof entry !== "object"
      || !Number.isInteger(entry.keyId)
      || typeof entry.purpose !== "string"
      || typeof entry.securityLevel !== "string"
    ) {
      fail("each identityKey must be { keyId, purpose, securityLevel }");
    }

    const purposeValue = Purpose[entry.purpose];
    if (purposeValue === undefined) {
      fail(`unknown key purpose: ${entry.purpose}`);
    }

    const securityLevelValue = SecurityLevel[entry.securityLevel];
    if (securityLevelValue === undefined) {
      fail(`unknown security level: ${entry.securityLevel}`);
    }

    const key = new IdentityPublicKeyInCreation({
      keyId: entry.keyId,
      purpose: purposeValue,
      securityLevel: securityLevelValue,
      keyType: KeyType.ECDSA_SECP256K1,
      data: new Uint8Array(33).fill(entry.keyId + 1),
    });

    try {
      identity.addPublicKey(key.toIdentityPublicKey());
    } finally {
      key.free();
    }
    keyCount += 1;
  }

  const masterKeys = identity.publicKeys.filter((key) => key.isMaster);
  if (masterKeys.length !== 1) {
    fail(`expected exactly one master-level authentication key, found ${masterKeys.length}`);
  }

  const masterKey = masterKeys[0];
  if (
    Purpose[masterKey.purposeNumber] !== "AUTHENTICATION"
    || SecurityLevel[masterKey.securityLevelNumber] !== "MASTER"
  ) {
    fail("the mandatory master key must be an AUTHENTICATION key at the MASTER security level");
  }

  const purposes = [...new Set(identity.publicKeys.map((key) => Purpose[key.purposeNumber]))].sort();
  const securityLevels = [...new Set(identity.publicKeys.map((key) => SecurityLevel[key.securityLevelNumber]))].sort();

  process.stdout.write(`${JSON.stringify({
    type: "verification",
    status: "passed",
    keyCount,
    masterKeyId: masterKey.keyId,
    purposes,
    securityLevels,
  })}\n`);
} finally {
  identity.free();
  identifier.free();
}
