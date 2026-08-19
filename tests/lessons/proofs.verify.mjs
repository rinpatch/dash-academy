import init, { ProofInfo } from "@dashevo/wasm-sdk";

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing public proofInfoFields");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing public proofInfoFields");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "proofInfoFields") {
  fail("proofInfoFields is the only accepted public field");
}

if (!Array.isArray(learnerOutput.proofInfoFields)) {
  fail("proofInfoFields must be an array of field names");
}

const supplied = [...new Set(learnerOutput.proofInfoFields)].sort();

await init();

let proof;
try {
  proof = new ProofInfo(
    new Uint8Array(32).fill(1),
    new Uint8Array(32).fill(2),
    new Uint8Array(96).fill(3),
    1,
    new Uint8Array(32).fill(4),
    2,
  );

  const canonical = [
    "blockIdHash",
    "grovedbProof",
    "quorumHash",
    "quorumType",
    "round",
    "signature",
  ].sort();

  const expected = JSON.stringify(canonical);
  const actual = JSON.stringify(supplied);
  if (actual !== expected) {
    fail(`proofInfoFields does not match the WASM ProofInfo shape; expected ${expected}, got ${actual}`);
  }

  process.stdout.write(`${JSON.stringify({
    type: "verification",
    status: "passed",
    proofInfoFields: canonical,
  })}\n`);
} finally {
  proof?.free();
}