import init, { DataContract } from "@dashevo/wasm-sdk";

const publicOwnerId = "6YfP6tT9AK8HPVXMK7CQrhpc8VMg7frjEnXinSPvUmZC";

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing public documentSchemas");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing public documentSchemas");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "documentSchemas") {
  fail("documentSchemas is the only accepted public field");
}

const schemas = learnerOutput.documentSchemas;
if (!schemas || typeof schemas !== "object" || Array.isArray(schemas)) {
  fail("documentSchemas must be a public JSON object");
}

await init();

let contract;
try {
  contract = new DataContract({
    ownerId: publicOwnerId,
    identityNonce: 1n,
    schemas,
    fullValidation: true,
  });

  const documentTypes = Object.keys(contract.schemas).sort();
  if (documentTypes.length === 0) fail("documentSchemas must define a document type");

  process.stdout.write(`${JSON.stringify({
    type: "verification",
    status: "passed",
    documentTypes,
  })}\n`);
} finally {
  contract?.free();
}