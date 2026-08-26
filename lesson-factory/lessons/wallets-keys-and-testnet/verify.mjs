import init, { WasmSdk } from "@dashevo/wasm-sdk";

function fail(message) {
  throw new Error(message);
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let learnerOutput;
try {
  learnerOutput = JSON.parse(raw);
} catch {
  fail("Expected one JSON object containing public derivationPaths");
}

if (
  !learnerOutput
  || typeof learnerOutput !== "object"
  || Array.isArray(learnerOutput)
) {
  fail("Expected one JSON object containing public derivationPaths");
}

const fields = Object.keys(learnerOutput);
if (fields.length !== 1 || fields[0] !== "derivationPaths") {
  fail("derivationPaths is the only accepted public field");
}

const paths = learnerOutput.derivationPaths;
if (
  !paths
  || typeof paths !== "object"
  || Array.isArray(paths)
  || typeof paths.testnet !== "string"
  || typeof paths.mainnet !== "string"
) {
  fail("derivationPaths must be an object with testnet and mainnet path strings");
}

await init();

let testnetInfo;
let mainnetInfo;
try {
  testnetInfo = WasmSdk.derivationPathBip44Testnet(0, 0, 0);
  mainnetInfo = WasmSdk.derivationPathBip44Mainnet(0, 0, 0);

  const testnetPath = testnetInfo.path;
  const mainnetPath = mainnetInfo.path;

  if (paths.testnet !== testnetPath) {
    fail(`testnet derivation path must be ${testnetPath}, got ${paths.testnet}`);
  }
  if (paths.mainnet !== mainnetPath) {
    fail(`mainnet derivation path must be ${mainnetPath}, got ${paths.mainnet}`);
  }

  process.stdout.write(`${JSON.stringify({
    type: "verification",
    status: "passed",
    testnetPath,
    mainnetPath,
    testnetCoinType: testnetInfo.coinType,
    mainnetCoinType: mainnetInfo.coinType,
  })}\n`);
} finally {
  testnetInfo?.free();
  mainnetInfo?.free();
}
