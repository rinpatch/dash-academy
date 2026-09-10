import init, { PlatformAddress, WasmSdkBuilder, WasmTrustedContext } from "@dashevo/wasm-sdk";

const live = process.argv.includes("--live");
const fail = (message) => { throw new Error(message); };

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let output;
try { output = JSON.parse(raw); } catch { fail("Expected one JSON object containing a public address"); }
if (!output || typeof output !== "object" || Array.isArray(output)) fail("Expected one JSON object containing a public address");
if (Object.keys(output).length !== 1 || !("address" in output)) fail("address is the only accepted public field");
if (typeof output.address !== "string" || !output.address.startsWith("tdash1")) fail("address must be a Dash Platform testnet address");

await init();
let address;
try { address = PlatformAddress.fromBech32m(output.address); } catch { fail("address is not valid bech32m"); }
const normalized = address.toBech32m("testnet");
if (normalized !== output.address) fail("address is not a normalized testnet Platform address");

if (!live) {
  process.stdout.write(`${JSON.stringify({ type: "verification", status: "passed", address: normalized })}\n`);
} else {
  const context = await WasmTrustedContext.prefetchTestnet();
  const sdk = WasmSdkBuilder.testnet().withTrustedContext(context).withSettings(8000, 15000, 3, true).build();
  try {
    const info = await sdk.getAddressInfo(address);
    if (!info || info.balance === 0n) fail("address has no credits on testnet");
    const balanceCredits = info.balance.toString();
    info.free();
    process.stdout.write(`${JSON.stringify({ type: "verification", status: "passed", address: normalized, balanceCredits })}\n`);
  } finally {
    sdk.free();
    context.free();
  }
}

address.free();
