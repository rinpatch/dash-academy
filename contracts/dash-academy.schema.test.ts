import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";

/**
 * Runs the SDK's own contract validation over the schema, offline.
 *
 * Not a substitute for registering on testnet — this catches structural errors, not whether
 * the contract does what we want.
 */
test("the SDK validates the contract", async () => {
  const { DataContract, ensureInitialized } = await import("@dashevo/evo-sdk");
  await ensureInitialized();

  const schemas = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "dash-academy.schema.json"), "utf8"),
  );

  const contract = new DataContract({
    ownerId: new Uint8Array(32).fill(1),
    identityNonce: BigInt(1),
    schemas,
    fullValidation: true,
  });

  assert.ok(contract.id.toString().length > 0);
});
