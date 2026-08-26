import init, { Identifier } from "@dashevo/wasm-sdk";

const LIVE = process.argv.includes("--live");

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing a public identityId");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing a public identityId");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "identityId") {
  fail("identityId is the only accepted public field");
}

if (
  typeof learnerOutput.identityId !== "string"
  || learnerOutput.identityId.trim().length === 0
) {
  fail("identityId must be a non-empty Base58 string");
}

await init();

let identifier;
try {
  identifier = Identifier.fromBase58(learnerOutput.identityId.trim());
} catch {
  fail("identityId is not a valid Dash Platform identifier");
}

const normalized = identifier.toBase58();

if (!LIVE) {
  process.stdout.write(`${JSON.stringify({
    type: "verification",
    status: "passed",
    identityId: normalized,
  })}\n`);
} else {
  const { WasmTrustedContext, WasmSdkBuilder } = await import("@dashevo/wasm-sdk");

  const context = await WasmTrustedContext.prefetchTestnet();
  const sdk = WasmSdkBuilder.testnet()
    .withTrustedContext(context)
    .withSettings(8000, 15000, 3, true)
    .build();

  try {
    const response = await sdk.getIdentityWithProofInfo(identifier);
    const identity = response.data;
    if (!identity) fail("identity not found on testnet");

    const identityId = identity.id.toBase58();
    const balanceCredits = identity.balance.toString();
    const publicKeyCount = identity.publicKeys.length;

    identity.free();

    process.stdout.write(`${JSON.stringify({
      type: "verification",
      status: "passed",
      identityId,
      balanceCredits,
      publicKeyCount,
    })}\n`);
  } finally {
    sdk.free();
    context.free();
  }
}

identifier.free();
