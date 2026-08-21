import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "vitest";
import { fetchProgress, saveProgress } from "@/app/lib/progress-repository";
import { getPlatformConfig } from "@/app/lib/platform-config";

/**
 * Exercises the real write path against the configured network. Skipped unless the platform
 * env is present, so it stays out of the way of anyone without keys.
 *
 * This exists because everything else in the suite passes with the byteArray encoding wrong:
 * types, lint, build, and the offline schema check all agree on code Platform rejects.
 *
 *   npm run test:integration
 */
const configured = Boolean(getPlatformConfig());

describe.skipIf(!configured)("progress repository against Platform", () => {
  test("creates, reads back, then merges into the same record", async () => {
    const key = new Uint8Array(randomBytes(32));

    const created = await saveProgress(key, ["what-is-dash"]);
    assert.ok(created, "save returned nothing");
    assert.deepEqual(created.completed, new Set(["what-is-dash"]));

    const read = await fetchProgress(key);
    assert.ok(read, "document was not found after creating it");
    assert.equal(read.documentId, created.documentId);
    assert.deepEqual(read.completed, new Set(["what-is-dash"]));

    // Second write replaces the document; completion unions rather than overwriting.
    const updated = await saveProgress(key, ["identities"]);
    assert.ok(updated);
    assert.deepEqual(updated.completed, new Set(["what-is-dash", "identities"]));
    assert.equal(updated.revision, read.revision + BigInt(1));

    const reread = await fetchProgress(key);
    assert.deepEqual(reread?.completed, new Set(["what-is-dash", "identities"]));
  });

  test("an unknown learner key has no record", async () => {
    assert.equal(await fetchProgress(new Uint8Array(randomBytes(32))), null);
  });
});
