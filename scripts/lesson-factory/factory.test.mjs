import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadManifest, secretlessEnv, validateManifest } from "./lib.mjs";
import { command, repoRoot } from "./lib.mjs";
import { sandboxedNodeArgs } from "./testnet.mjs";

test("the curriculum has one fixed lesson per module", async () => {
  const manifest = await loadManifest();
  assert.equal(manifest.lessons.length, 17);
  assert.deepEqual(manifest.lessons.map((lesson) => lesson.module), Array.from({ length: 17 }, (_, index) => index + 1));
});

test("manifest validation rejects duplicate modules", async () => {
  const manifest = structuredClone(await loadManifest());
  manifest.lessons[1].module = 1;
  assert.throws(() => validateManifest(manifest), /duplicate module/);
});

test("Codex child environment excludes common credential variables", () => {
  process.env.CERTIFICATE_ISSUER_MNEMONIC = "never-forward-me";
  process.env.OPENAI_API_KEY = "also-not-forwarded";
  const env = secretlessEnv();
  assert.equal(env.CERTIFICATE_ISSUER_MNEMONIC, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  delete process.env.CERTIFICATE_ISSUER_MNEMONIC;
  delete process.env.OPENAI_API_KEY;
});

test("live learner sandbox cannot read the main checkout secret file", { skip: process.platform !== "darwin" }, async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "dash-lesson-sandbox-"));
  try {
    const secret = path.join(repoRoot, ".env.local");
    const script = `const fs=require("node:fs");try{fs.readFileSync(${JSON.stringify(secret)});process.exit(9)}catch{process.exit(0)}`;
    const sandbox = sandboxedNodeArgs(temporary, ["-e", script]);
    const result = await command(sandbox.program, sandbox.args, { cwd: temporary, env: secretlessEnv() });
    assert.equal(result.code, 0);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
