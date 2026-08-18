#!/usr/bin/env node
import { access, mkdir, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { browserTest } from "./lesson-factory/browser.mjs";
import { runCodex } from "./lesson-factory/codex.mjs";
import { command, hash, latestRunId, lessonKey, loadManifest, manifestPath, parseArgs, readJson, repoRoot, runRoot, writeJson } from "./lesson-factory/lib.mjs";
import { liveTest, validateLiveConfiguration } from "./lesson-factory/testnet.mjs";
import { deterministicTests, validateLesson } from "./lesson-factory/validate.mjs";
import { assertAllowedChanges, assertPreparedBaseline, changedFiles, commitLesson, createWorktree } from "./lesson-factory/worktree.mjs";

let stateWrite = Promise.resolve();

const args = parseArgs(process.argv.slice(2));
const action = args._[0] ?? "status";

try {
  if (action === "preflight") await preflight();
  else if (action === "validate") await validateCommand();
  else if (action === "run" || action === "resume") await runCommand(action === "resume");
  else if (action === "status") await statusCommand();
  else if (action === "questions") await questionsCommand();
  else if (action === "answer") await answerCommand();
  else if (action === "test") await testCommand();
  else if (action === "integrate") await integrateCommand();
  else usage(`Unknown command ${action}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function preflight() {
  const manifest = await loadManifest();
  const checks = [];
  for (const [label, program, programArgs] of [
    ["git", "git", ["--version"]], ["Codex", "codex", ["--version"]], ["Node", "node", ["--version"]],
  ]) {
    const result = await command(program, programArgs);
    checks.push({ label, passed: result.code === 0, detail: (result.stdout || result.stderr).trim() });
  }
  const secretFiles = await readableSecretFiles();
  checks.push({ label: "secretless agent workspace", passed: secretFiles.length === 0, detail: secretFiles.length ? `Move outside checkout: ${secretFiles.join(", ")}` : "ok" });
  checks.push({ label: "curriculum", passed: manifest.lessons.length === 17, detail: "17 fixed modules" });
  for (const check of checks) console.log(`${check.passed ? "✓" : "✗"} ${check.label}: ${check.detail}`);
  if (checks.some((check) => !check.passed)) process.exitCode = 1;
}

async function validateCommand() {
  const manifest = await loadManifest();
  let selected;
  if (args.module || args.tier || args.all) selected = selectLessons(manifest);
  else {
    selected = [];
    for (const lesson of manifest.lessons) {
      try { await access(path.join(repoRoot, "content/academy", `${lesson.slug}.mdx`)); selected.push(lesson); } catch {}
    }
  }
  const allErrors = [];
  for (const lesson of selected) {
    const errors = await validateLesson(lesson, repoRoot, { complete: false });
    if (errors.length) allErrors.push({ module: lesson.module, slug: lesson.slug, errors });
  }
  if (allErrors.length) {
    console.log(JSON.stringify(allErrors, null, 2));
    process.exitCode = 1;
  } else console.log(`Validated ${selected.length} lesson(s).`);
}

async function runCommand(resume) {
  const manifest = await loadManifest();
  const selected = selectLessons(manifest);
  if (args.dry_run) {
    for (const lesson of selected) console.log(`${lessonKey(lesson)}: research → question gate → author → static/fixture/build → 3 browsers → 2 reviews → commit${lesson.tier === "sdk" ? " → serialized sandboxed live testnet verification" : ""}`);
    return;
  }
  await mkdir(runRoot, { recursive: true });
  const lockPath = path.join(runRoot, "orchestrator.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Another lesson orchestrator is running"); throw error; }
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  try {
  const secretFiles = await readableSecretFiles();
  if (secretFiles.length) throw new Error(`Agent run refused: move secret-bearing files outside the checkout first: ${secretFiles.join(", ")}`);
  if (selected.some((lesson) => lesson.tier === "sdk")) validateLiveConfiguration();
  const baseline = await assertPreparedBaseline();
  const runId = args.run_id ?? (resume ? await requireRunId() : makeRunId());
  const runDir = path.join(runRoot, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runRoot, "latest"), `${runId}\n`, { mode: 0o600 });
  let state = await loadOrCreateRun(runDir, runId, baseline, manifest);
  for (const lesson of selected) {
    const item = state.lessons[lesson.module];
    if (!item.worktree) {
      item.status = "preparing";
      await saveState(runDir, state, item);
      Object.assign(item, await createWorktree({ runId: state.runId, lesson, baseline }));
      item.status = "pending";
      await saveState(runDir, state, item);
    }
  }
  const concurrency = Math.max(1, Math.min(6, Number(args.concurrency ?? 3)));
  const queue = selected.slice();
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const lesson = queue.shift();
      try { await processLesson({ lesson, state, runDir, baseline }); }
      catch (error) {
        const item = state.lessons[lesson.module];
        item.status = "failed";
        item.error = error instanceof Error ? error.message : String(error);
        item.updatedAt = new Date().toISOString();
        await saveState(runDir, state, item);
      }
    }
  });
  await Promise.all(workers);
  for (const lesson of selected.filter((candidate) => candidate.tier === "sdk")) {
    const item = state.lessons[lesson.module];
    if (item.status !== "local-passed") continue;
    const lessonDir = path.join(runDir, "lessons", lessonKey(lesson));
    item.status = "testnet";
    await saveState(runDir, state, item);
    try {
      item.liveTest = await liveTest({ lesson, worktree: item.worktree, lessonDir });
      item.status = "passed";
      await saveState(runDir, state, item);
    } catch (error) {
      item.status = "failed";
      item.error = error instanceof Error ? error.message : String(error);
      await saveState(runDir, state, item);
    }
  }
  const statuses = selected.map((lesson) => state.lessons[lesson.module].status);
  printRun(state, selected);
  if (statuses.includes("blocked")) process.exitCode = 2;
  else if (statuses.some((status) => status !== "passed")) process.exitCode = 1;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

async function processLesson({ lesson, state, runDir, baseline }) {
  const item = state.lessons[lesson.module];
  if (item.status === "passed") return;
  if (item.commit) { item.status = lesson.tier === "sdk" ? "local-passed" : "passed"; return; }
  const lessonDir = path.join(runDir, "lessons", lessonKey(lesson));
  await mkdir(lessonDir, { recursive: true });
  if (!item.worktree) Object.assign(item, await createWorktree({ runId: state.runId, lesson, baseline }));
  const worktree = item.worktree;
  item.status = "researching";
  await saveState(runDir, state, item);
  if (!item.research) item.research = await runCodex({ role: "research", lesson, cwd: worktree, lessonDir });
  const blockers = item.research.uncertainties.filter((uncertainty) => uncertainty.blocking && !item.answers?.[uncertainty.id]);
  if (blockers.length || (item.research.status === "blocked" && !(item.research.uncertainties ?? []).length)) {
    item.status = "blocked";
    await saveState(runDir, state, item);
    return;
  }
  item.status = "authoring";
  await saveState(runDir, state, item);
  await runCodex({ role: "author", lesson, cwd: worktree, lessonDir, context: { research: item.research, answers: item.answers ?? {} } });
  await testAndReview({ lesson, item, state, runDir, lessonDir, worktree });
}

async function testAndReview({ lesson, item, state, runDir, lessonDir, worktree }) {
  for (let revision = 0; revision <= 2; revision += 1) {
    item.status = revision ? "revising" : "testing";
    await saveState(runDir, state, item);
    const files = await changedFiles(worktree);
    assertAllowedChanges(lesson, files);
    const validation = await validateLesson(lesson, worktree, { complete: true });
    const deterministic = validation.length ? [] : await deterministicTests(lesson, worktree);
    const deterministicPassed = !validation.length && deterministic.every((test) => test.passed);
    const browser = deterministicPassed ? await browserTest({ lesson, worktree, runId: state.runId, lessonDir }).catch((error) => ({ passed: false, error: error.message })) : { passed: false, skipped: true };
    item.tests = { validation, deterministic, browser };
    item.status = "reviewing";
    await saveState(runDir, state, item);
    const diff = (await command("git", ["diff", "--", ...files], { cwd: worktree })).stdout;
    const fileContents = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(path.join(worktree, file), "utf8")])));
    const context = { research: item.research, answers: item.answers ?? {}, tests: item.tests, diff, fileContents };
    const [facts, pedagogy] = await Promise.all([
      runCodex({ role: "facts-review", lesson, cwd: worktree, lessonDir, context, attempt: revision + 1 }),
      runCodex({ role: "pedagogy-review", lesson, cwd: worktree, lessonDir, context, attempt: revision + 1 }),
    ]);
    item.reviews = { facts, pedagogy };
    const passed = deterministicPassed && browser.passed && facts.verdict === "pass" && pedagogy.verdict === "pass";
    if (passed) {
      const finalFiles = await changedFiles(worktree);
      assertAllowedChanges(lesson, finalFiles);
      item.commit = await commitLesson(worktree, lesson, finalFiles);
      item.status = lesson.tier === "sdk" ? "local-passed" : "passed";
      await saveState(runDir, state, item);
      return;
    }
    if (facts.verdict === "block" || pedagogy.verdict === "block") {
      item.status = "blocked";
      await saveState(runDir, state, item);
      return;
    }
    if (revision === 2) throw new Error("Lesson did not pass after two revisions");
    await runCodex({ role: "revision", lesson, cwd: worktree, lessonDir, context: item.tests ? { tests: item.tests, reviews: item.reviews } : item.reviews, attempt: revision + 1 });
  }
}

async function statusCommand() {
  const runId = args.run_id ?? await latestRunId();
  if (!runId) { console.log("No lesson runs yet."); return; }
  const state = await readJson(path.join(runRoot, runId, "run.json"));
  if (args.json) console.log(JSON.stringify(state, null, 2));
  else printRun(state);
}

async function questionsCommand() {
  const state = await loadCurrentRun();
  const rows = [];
  for (const item of Object.values(state.lessons)) for (const question of item.research?.uncertainties ?? []) {
    if (question.blocking && !item.answers?.[question.id]) rows.push({ module: item.module, id: question.id, question: question.question, why: question.whyItMatters, options: question.options, recommendation: question.recommendation });
  }
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else if (!rows.length) console.log("No unanswered blocking questions.");
  else for (const row of rows) console.log(`Module ${row.module} [${row.id}]\n${row.question}\nWhy: ${row.why}\nOptions: ${row.options.join(" | ")}\nRecommended: ${row.recommendation}\n`);
}

async function answerCommand() {
  const moduleNumber = Number(args._[1] ?? args.module);
  if (!moduleNumber) usage("answer requires a module number");
  const state = await loadCurrentRun();
  const item = state.lessons[moduleNumber];
  if (!item) throw new Error(`Module ${moduleNumber} is not in this run`);
  const unanswered = (item.research?.uncertainties ?? []).filter((question) => question.blocking && !item.answers?.[question.id]);
  const question = args.question ? unanswered.find((candidate) => candidate.id === args.question) : unanswered[0];
  if (!question) throw new Error("No matching unanswered question");
  let answer = args.text;
  if (!answer) {
    const terminal = readline.createInterface({ input: stdin, output: stdout });
    answer = await terminal.question(`${question.question}\n> `);
    terminal.close();
  }
  item.answers ??= {};
  item.answers[question.id] = answer;
  if ((item.research.uncertainties ?? []).every((candidate) => !candidate.blocking || item.answers[candidate.id])) item.status = "ready";
  await writeJson(path.join(runRoot, state.runId, "run.json"), state);
  console.log(`Recorded answer for module ${moduleNumber}, ${question.id}.`);
}

async function testCommand() {
  const moduleNumber = Number(args._[1] ?? args.module);
  const manifest = await loadManifest();
  const lesson = manifest.lessons.find((candidate) => candidate.module === moduleNumber);
  if (!lesson) throw new Error("test requires a valid module number");
  const state = await loadCurrentRun();
  const item = state.lessons[moduleNumber];
  if (!item?.worktree) throw new Error("Lesson has no worktree");
  const lessonDir = path.join(runRoot, state.runId, "lessons", lessonKey(lesson));
  if (args.live) {
    const active = Object.values(state.lessons).some((candidate) => ["researching", "authoring", "reviewing", "revising", "testing"].includes(candidate.status));
    if (active) throw new Error("Stop all agent and browser stages before a live test");
    await liveTest({ lesson, worktree: item.worktree, lessonDir });
    console.log(`Live test passed for module ${moduleNumber}.`);
  } else {
    const validation = await validateLesson(lesson, item.worktree, { complete: true });
    const deterministic = validation.length ? [] : await deterministicTests(lesson, item.worktree);
    const browser = args.browser || args.all ? await browserTest({ lesson, worktree: item.worktree, runId: state.runId, lessonDir }) : null;
    console.log(JSON.stringify({ validation, deterministic, browser }, null, 2));
    if (validation.length || deterministic.some((entry) => !entry.passed) || browser?.passed === false) process.exitCode = 1;
  }
}

async function integrateCommand() {
  const tier = Number(args.tier);
  if (![1, 2].includes(tier)) usage("integrate requires --tier 1 or --tier 2");
  const state = await loadCurrentRun();
  const manifest = await loadManifest();
  const lessons = manifest.lessons.filter((lesson) => tier === 1 ? lesson.module <= 7 : lesson.module >= 8);
  const missing = lessons.filter((lesson) => state.lessons[lesson.module]?.status !== "passed");
  if (missing.length) throw new Error(`Cannot integrate; non-passing modules: ${missing.map((lesson) => lesson.module).join(", ")}`);
  const branch = `academy-tier-${tier}-${state.runId}`;
  const worktree = path.resolve(repoRoot, "../.dash-academy-worktrees", state.runId, `integration-tier-${tier}`);
  const add = await command("git", ["worktree", "add", "-b", branch, worktree, state.baseline]);
  if (add.code !== 0) throw new Error(add.stderr);
  await symlink(path.join(repoRoot, "node_modules"), path.join(worktree, "node_modules"), "dir");
  for (const lesson of lessons) {
    const pick = await command("git", ["cherry-pick", state.lessons[lesson.module].commit], { cwd: worktree });
    if (pick.code !== 0) throw new Error(`Cherry-pick failed for module ${lesson.module}: ${pick.stderr}`);
  }
  const pages = [];
  for (const lesson of manifest.lessons) {
    try { await access(path.join(worktree, "content/academy", `${lesson.slug}.mdx`)); pages.push(lesson.slug); } catch {}
  }
  await writeFile(path.join(worktree, "content/academy/meta.json"), `${JSON.stringify({ title: "Dash Academy", pages }, null, 2)}\n`);
  await command("git", ["add", "content/academy/meta.json"], { cwd: worktree });
  await command("git", ["commit", "-m", `content(academy): integrate tier ${tier}`], { cwd: worktree });
  for (const [program, programArgs] of [["npm", ["run", "lint"]], ["npm", ["run", "build"]]]) {
    const result = await command(program, programArgs, { cwd: worktree });
    if (result.code !== 0) throw new Error(`Integration check failed: ${program} ${programArgs.join(" ")}\n${result.stderr}`);
  }
  console.log(`Created local integration branch ${branch} at ${worktree}`);
}

function selectLessons(manifest) {
  if (args.module) {
    const lesson = manifest.lessons.find((candidate) => candidate.module === Number(args.module));
    if (!lesson) throw new Error(`Unknown module ${args.module}`);
    return [lesson];
  }
  if (args.tier) return manifest.lessons.filter((lesson) => Number(args.tier) === 1 ? lesson.module <= 7 : lesson.module >= 8);
  if (args.all) return manifest.lessons;
  throw new Error("Select --module N, --tier 1|2, or --all");
}

async function loadOrCreateRun(runDir, runId, baseline, manifest) {
  try { return await readJson(path.join(runDir, "run.json")); } catch {}
  const state = { schemaVersion: 1, runId, baseline, manifestHash: hash(await readFile(manifestPath, "utf8")), createdAt: new Date().toISOString(), lessons: {} };
  for (const lesson of manifest.lessons) state.lessons[lesson.module] = { module: lesson.module, slug: lesson.slug, status: "pending", answers: {} };
  await writeJson(path.join(runDir, "run.json"), state);
  return state;
}

async function saveState(runDir, state, item) {
  item.updatedAt = new Date().toISOString();
  stateWrite = stateWrite.then(() => writeJson(path.join(runDir, "run.json"), state));
  await stateWrite;
}

async function loadCurrentRun() {
  const runId = args.run_id ?? await requireRunId();
  return readJson(path.join(runRoot, runId, "run.json"));
}

async function requireRunId() {
  const runId = await latestRunId();
  if (!runId) throw new Error("No lesson run exists");
  return runId;
}

function makeRunId() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readableSecretFiles() {
  const candidates = [".env.local", ".issuer-identity.local.json"];
  const found = [];
  for (const file of candidates) try { await access(path.join(repoRoot, file)); found.push(file); } catch {}
  return found;
}

function printRun(state, lessons) {
  const selected = lessons ?? Object.values(state.lessons);
  console.log(`Run ${state.runId} (${state.baseline.slice(0, 10)})`);
  for (const lesson of selected) {
    const item = state.lessons[lesson.module] ?? lesson;
    console.log(`${String(item.module).padStart(2, "0")} ${item.slug}: ${item.status}${item.error ? ` — ${item.error}` : ""}`);
  }
}

function usage(message) {
  throw new Error(`${message}\nUsage: lessons <preflight|validate|run|resume|status|questions|answer|test|integrate> [options]`);
}
