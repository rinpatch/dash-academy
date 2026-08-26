import init, { Document, Identifier } from "@dashevo/wasm-sdk";

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing a public document");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing a public document");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "document") {
  fail("document is the only accepted public field");
}

const document = learnerOutput.document;
if (!document || typeof document !== "object" || Array.isArray(document)) {
  fail("document must be a public JSON object");
}

await init();

function base58(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a valid Base58 identifier`);
  }
  try {
    return Identifier.fromBase58(value.trim());
  } catch {
    fail(`${label} must be a valid Base58 identifier`);
  }
}

const id = base58(document.$id, "document.$id");
const dataContractId = base58(document.$dataContractId, "document.$dataContractId");
const ownerId = base58(document.$ownerId, "document.$ownerId");

if (typeof document.$type !== "string" || document.$type.length < 1 || document.$type.length > 64) {
  fail("document.$type must be a non-empty string");
}

let revision;
try {
  revision = BigInt(document.$revision);
} catch {
  fail("document.$revision must be an integer of at least 1");
}
if (revision < 1n) fail("document.$revision must be an integer of at least 1");

let entropy;
try {
  entropy = Buffer.from(document.$entropy, "base64");
} catch {
  fail("document.$entropy must be 32 bytes of base64");
}
if (entropy.length !== 32) fail("document.$entropy must be 32 bytes of base64");

const derivedBytes = Document.generateId(
  document.$type,
  ownerId,
  dataContractId,
  entropy,
);
const derivedId = Identifier.fromBytes(derivedBytes).toBase58();
const normalizedId = id.toBase58();

if (derivedId !== normalizedId) {
  fail("derived document id does not match $id");
}

id.free();
dataContractId.free();
ownerId.free();

process.stdout.write(`${JSON.stringify({
  type: "verification",
  status: "passed",
  documentId: normalizedId,
  revision: revision.toString(),
})}\n`);
