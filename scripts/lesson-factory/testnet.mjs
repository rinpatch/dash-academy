import { accessSync } from "node:fs";
import { mkdir, open, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import { command, repoRoot, secretlessEnv } from "./lib.mjs";

export async function liveTest({ lesson, worktree, lessonDir }) {
  if (process.env.DASH_TESTNET_LIVE !== "1") throw new Error("Live writes require DASH_TESTNET_LIVE=1");
  assertSecretOutsideCheckout();
  const guards = readGuards();
  const fixture = path.join(worktree, "tests/lessons", `${lesson.slug}.mjs`);
  const verifier = path.join(worktree, "tests/lessons", `${lesson.slug}.verify.mjs`);
  const signer = process.env.DASH_TESTNET_SIGNER_COMMAND;
  const commonDir = (await command("git", ["rev-parse", "--git-common-dir"], { cwd: repoRoot })).stdout.trim();
  const lock = path.resolve(repoRoot, commonDir, "dash-academy-testnet.lock");
  let handle;
  let learner;
  try {
    handle = await open(lock, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), module: lesson.module }));
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Another live writer owns ${lock}`);
    throw error;
  }
  try {
    const before = await signerCall(signer, { action: "status", network: "testnet" });
    const balanceBefore = positiveBigInt(before.balanceCredits, "signer balanceCredits");
    const learnerProcess = learnerNodeArgs([fixture, "--live-protocol"]);
    learner = spawn(learnerProcess.program, learnerProcess.args, {
      cwd: worktree,
      env: secretlessEnv({ DASH_TESTNET_LIVE: "1", DASH_LESSON_RUN_ID: path.basename(path.dirname(path.dirname(lessonDir))) }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let learnerStderr = "";
    learner.stderr.on("data", (chunk) => { learnerStderr += chunk; });
    const lines = readline.createInterface({ input: learner.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
    const request = parseProtocol(await nextLine(lines, 30_000, "learner funding request"));
    if (request.type !== "funding-request" || request.operation !== lesson.verification.operation || typeof request.address !== "string") throw new Error("Learner fixture returned an invalid funding request");
    const amount = nonNegativeBigInt(request.amountCredits, "funding amount");
    const runDir = path.dirname(path.dirname(lessonDir));
    const alreadySpent = await priorRunSpend(runDir);
    if (amount + guards.fee > guards.lesson || alreadySpent + amount + guards.fee > guards.run) throw new Error("Fixture funding request plus fee headroom exceeds configured cap");
    if (balanceBefore - amount - guards.fee < guards.reserve) throw new Error("Treasury reserve would be breached");
    const funding = amount === 0n ? { status: "funded", reference: "read-only", amountCredits: "0" } : await signerCall(signer, {
      action: "fund", network: "testnet", recipient: request.address, amountCredits: amount.toString(), maxFeeCredits: guards.fee.toString(), namespace: `da-${lesson.module}-${Date.now()}`,
    });
    if (funding.status !== "funded") throw new Error("External signer did not confirm funding; write was not retried");
    // Same EPIPE hazard as command(): a fixture that exits early must not crash the orchestrator.
    learner.stdin.on("error", () => {});
    learner.stdin.write(`${JSON.stringify({ type: "funding-result", ...funding })}\n`);
    learner.stdin.end();
    const outcome = parseProtocol(await nextLine(lines, 180_000, "learner result"));
    const exitCode = await new Promise((resolve) => learner.once("close", (code) => resolve(code ?? 1)));
    if (exitCode !== 0 || outcome.type !== "result" || outcome.status !== "passed") throw new Error(`Learner operation failed: ${redact(learnerStderr)}`);
    const verifierProcess = learnerNodeArgs([verifier, "--live"]);
    const verification = await command(verifierProcess.program, verifierProcess.args, { cwd: worktree, env: secretlessEnv(), input: `${JSON.stringify(outcome.publicResult)}\n` });
    if (verification.code !== 0) throw new Error(`Independent proof verification failed: ${redact(verification.stderr)}`);
    const after = await signerCall(signer, { action: "status", network: "testnet" });
    const balanceAfter = positiveBigInt(after.balanceCredits, "post-run signer balanceCredits");
    const observedSpend = balanceBefore > balanceAfter ? balanceBefore - balanceAfter : 0n;
    const withinCaps = balanceAfter >= guards.reserve && observedSpend <= guards.lesson && alreadySpent + observedSpend <= guards.run;
    const report = {
      module: lesson.module, slug: lesson.slug, at: new Date().toISOString(), passed: withinCaps,
      operation: lesson.verification.operation, publicResult: outcome.publicResult,
      funding: { amountCredits: amount.toString(), reference: funding.reference ?? null },
      treasury: { beforeCredits: balanceBefore.toString(), afterCredits: balanceAfter.toString(), observedSpendCredits: observedSpend.toString() },
      verification: parseProtocol(verification.stdout.trim()),
    };
    await mkdir(path.join(lessonDir, "tests"), { recursive: true });
    await writeFile(path.join(lessonDir, "tests", "testnet.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    if (!withinCaps) throw new Error("Observed live spend exceeded a configured cap; the public ledger was preserved");
    return report;
  } finally {
    if (learner?.exitCode === null) learner.kill("SIGTERM");
    await handle.close();
    await rm(lock, { force: true });
  }
}

export function validateLiveConfiguration() {
  if (process.env.DASH_TESTNET_LIVE !== "1") throw new Error("Tier 2 runs require DASH_TESTNET_LIVE=1");
  assertSecretOutsideCheckout();
  readGuards();
}

async function signerCall(executable, request) {
  if (!path.isAbsolute(executable)) throw new Error("DASH_TESTNET_SIGNER_COMMAND must be an absolute executable path");
  const result = await command(executable, [], { env: secretlessEnv(), input: `${JSON.stringify(request)}\n` });
  if (result.code !== 0) throw new Error(`External signer failed: ${redact(result.stderr)}`);
  return parseProtocol(result.stdout.trim());
}

async function nextLine(iterator, timeout, label) {
  return await Promise.race([
    iterator.next().then(({ value, done }) => { if (done) throw new Error(`${label} stream ended`); return value; }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout)),
  ]);
}

function parseProtocol(value) {
  try { return JSON.parse(value); } catch { throw new Error("Protocol process returned invalid JSON"); }
}

function assertSecretOutsideCheckout() {
  if (process.env.CERTIFICATE_ISSUER_MNEMONIC) throw new Error("Issuer mnemonic must not be passed via the runner environment");
  throwIfReadable(path.join(repoRoot, ".env.local"));
  throwIfReadable(path.join(repoRoot, ".issuer-identity.local.json"));
  if (!process.env.DASH_TESTNET_SIGNER_COMMAND) throw new Error("Set DASH_TESTNET_SIGNER_COMMAND to an external signer; in-repo mnemonic loading is forbidden");
  if (!path.isAbsolute(process.env.DASH_TESTNET_SIGNER_COMMAND)) throw new Error("DASH_TESTNET_SIGNER_COMMAND must be an absolute executable path");
  try { accessSync(process.env.DASH_TESTNET_SIGNER_COMMAND); } catch { throw new Error("DASH_TESTNET_SIGNER_COMMAND is not readable"); }
}

function throwIfReadable(file) {
  try { accessSync(file); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error(`Move secret-bearing ${path.basename(file)} outside the checkout before live tests`);
}

function readGuards() {
  const parse = (name) => positiveBigInt(process.env[name], name);
  const guards = { reserve: parse("DASH_TESTNET_RESERVE_CREDITS"), run: parse("DASH_TESTNET_MAX_RUN_CREDITS"), lesson: parse("DASH_TESTNET_MAX_LESSON_CREDITS"), fee: parse("DASH_TESTNET_MAX_TRANSITION_FEE_CREDITS") };
  if (guards.lesson > guards.run) throw new Error("Lesson cap cannot exceed run cap");
  return guards;
}

function positiveBigInt(value, label) {
  const parsed = nonNegativeBigInt(value, label);
  if (parsed === 0n) throw new Error(`${label} must be positive`);
  return parsed;
}

function nonNegativeBigInt(value, label) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${label} must be a non-negative integer string`);
  return BigInt(value);
}

function redact(value) {
  return value.replace(/\b(?:[a-z]+\s+){11,23}[a-z]+\b/gi, "[REDACTED]");
}

async function priorRunSpend(runDir) {
  const lessonsDir = path.join(runDir, "lessons");
  let entries;
  try { entries = await readdir(lessonsDir); } catch { return 0n; }
  let total = 0n;
  for (const entry of entries) {
    try {
      const report = JSON.parse(await readFile(path.join(lessonsDir, entry, "tests", "testnet.json"), "utf8"));
      total += nonNegativeBigInt(report.treasury?.observedSpendCredits, "ledger observed spend");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return total;
}

// Fixtures and verifiers run unsandboxed: the macOS-only seatbelt profile was removed because there
// is no cross-platform equivalent, and this pipeline runs on a developer's own machine. Note this
// means model-authored lesson code runs with full user privileges.
export function learnerNodeArgs(nodeArgs) {
  return { program: process.execPath, args: nodeArgs };
}
