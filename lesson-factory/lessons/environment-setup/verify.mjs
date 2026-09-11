import init, { WasmSdkBuilder, WasmTrustedContext } from "@dashevo/wasm-sdk";

const live = process.argv.includes("--live");
const fail = (message) => { throw new Error(message); };

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let output;
try { output = JSON.parse(raw); } catch { fail("Expected one JSON object containing a public height"); }
if (!output || typeof output !== "object" || Array.isArray(output)) fail("Expected one JSON object containing a public height");
if (Object.keys(output).length !== 1 || !("height" in output)) fail("height is the only accepted public field");
if (typeof output.height !== "string" || !/^\d+$/.test(output.height)) fail("height must be a non-negative integer string");

const observed = BigInt(output.height);
if (!live) {
  process.stdout.write(`${JSON.stringify({ type: "verification", status: "passed", height: observed.toString() })}\n`);
} else {
  await init();
  const context = await WasmTrustedContext.prefetchTestnet();
  const sdk = WasmSdkBuilder.testnet().withTrustedContext(context).withSettings(8000, 15000, 3, true).build();
  try {
    const status = await sdk.getStatus();
    const current = BigInt(status.chain.latest_block_height);
    status.free();
    const oldestAccepted = current > 5000n ? current - 5000n : 0n;
    if (observed > current + 10n || observed < oldestAccepted) fail("height is not a recent testnet Platform height");
    process.stdout.write(`${JSON.stringify({
      type: "verification", status: "passed", height: observed.toString(), currentHeight: current.toString(),
    })}\n`);
  } finally {
    sdk.free();
    context.free();
  }
}
