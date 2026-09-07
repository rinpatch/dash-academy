import assert from "node:assert/strict";
import { test } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { glossaryIds, lessonTier, loadManifest, secretlessEnv, selectIntegrationPages, validateManifest } from "./lib.mjs";
import { command, repoRoot } from "./lib.mjs";
import { buildPrompt, formatEvent, parseResult, shouldRetryAgent, validateStageOutput } from "./agent.mjs";
import { checkLength, usesComponent, validateLesson, VERIFICATION_COMPONENTS } from "./validate.mjs";
import { orderedLessons, previousLessons, runSequentially } from "./sequence.mjs";
import { assertAllowedChanges, changedFiles, commitLesson, withWorkspaceLock } from "./workspace.mjs";

test("agent result parsing takes the last assistant message and surfaces provider errors", () => {
  const line = (event) => `${JSON.stringify(event)}\n`;
  const stream =
    line({ type: "step_start", part: {} }) +
    line({ type: "text", part: { text: "thinking out loud" } }) +
    line({ type: "text", part: { text: '```json\n{"verdict":"pass","findings":[]}\n```' } }) +
    line({ type: "step_finish", part: {} });
  assert.deepEqual(parseResult(stream, "facts-review", "x.log"), { verdict: "pass", findings: [] });
  assert.throws(() => parseResult(line({ type: "error", error: { data: { message: "No payment method" } } }), "author", "x.log"), /No payment method/);
  assert.throws(() => parseResult(line({ type: "text", part: { text: "sorry, I cannot" } }), "author", "x.log"), /no JSON object/);
});

test("the curriculum has one fixed lesson per module", async () => {
  const manifest = await loadManifest();
  const count = manifest.lessons.length;
  assert.deepEqual(manifest.lessons.map((lesson) => lesson.module), Array.from({ length: count }, (_, index) => index + 1));
});

test("package commands enter the lesson factory through its CLI", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.lessons, "node lesson-factory/cli.mjs");
  assert.equal(packageJson.scripts["lessons:validate"], "node lesson-factory/cli.mjs validate");
});

test("tiers interleave rather than splitting the course at a fixed module", async () => {
  const manifest = await loadManifest();
  const tiers = manifest.lessons.map(lessonTier);
  // A concepts lesson appearing after an sdk lesson is the whole point of the interleaved order;
  // if this ever holds, something has silently reverted to the old concepts-then-sdk split.
  assert.ok(tiers.indexOf(1) < tiers.lastIndexOf(1));
  assert.ok(tiers.indexOf(2) < tiers.lastIndexOf(1), "expected at least one concepts lesson after the first sdk lesson");
});

test("manifest validation rejects duplicate modules", async () => {
  const manifest = structuredClone(await loadManifest());
  manifest.lessons[1].module = 1;
  assert.throws(() => validateManifest(manifest), /duplicate module/);
});

test("Tier 2 integration retains valid prerequisite pages without admitting stale later pages", async () => {
  const lessons = (await loadManifest()).lessons;
  const conceptModules = new Set(lessons.filter((lesson) => lessonTier(lesson) === 1).map((lesson) => lesson.module));
  const runLessons = Object.fromEntries(lessons.map((lesson) => [lesson.module, {
    status: lessonTier(lesson) === 2 ? "passed" : "pending",
  }]));
  const pages = selectIntegrationPages({
    lessons,
    tier: 2,
    runLessons,
    validPrerequisiteModules: new Set(conceptModules),
  });
  assert.deepEqual(pages, lessons.map((lesson) => lesson.slug));

  // An sdk lesson that did not pass this run must stay out even when it is listed as a valid
  // prerequisite module — only concepts pages are admitted on that path.
  const staleSdk = lessons.find((lesson) => lessonTier(lesson) === 2);
  runLessons[staleSdk.module].status = "pending";
  const withoutUnpassedTier2Page = selectIntegrationPages({
    lessons,
    tier: 2,
    runLessons,
    validPrerequisiteModules: new Set([...conceptModules, staleSdk.module]),
  });
  assert.equal(withoutUnpassedTier2Page.includes(staleSdk.slug), false);
});

test("Agent child environment excludes common credential variables", () => {
  process.env.CERTIFICATE_ISSUER_MNEMONIC = "never-forward-me";
  process.env.OPENAI_API_KEY = "also-not-forwarded";
  const env = secretlessEnv();
  assert.equal(env.CERTIFICATE_ISSUER_MNEMONIC, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  delete process.env.CERTIFICATE_ISSUER_MNEMONIC;
  delete process.env.OPENAI_API_KEY;
});

test("agent event formatting summarises tool calls and skips noise", () => {
  const lesson = { module: 1 };
  const now = Date.now();
  const format = (event, cwd) => formatEvent(lesson, "author", now, typeof event === "string" ? event : JSON.stringify(event), cwd);
  assert.match(
    format({ type: "tool_use", part: { tool: "read", state: { status: "completed", input: { filePath: "/wt/content/academy/a.mdx" } } } }, "/wt"),
    /^\[m01 author \+\d+s\] read content\/academy\/a\.mdx$/,
  );
  assert.match(format({ type: "error", error: { data: { message: "boom" } } }), /error: boom/);
  assert.equal(format({ type: "tool_use", part: { tool: "read", state: { status: "pending", input: {} } } }), null);
  assert.equal(format({ type: "step_start", part: {} }), null);
  assert.equal(format("not json"), null);
});

test("glossary ids are read from lib/glossary.ts and match its real keys", async () => {
  const source = await readFile(path.join(repoRoot, "lib/glossary.ts"), "utf8");
  const ids = await glossaryIds(source);
  assert.ok(ids.includes("smart-contract") && ids.includes("grpc"), "known terms are found");
  // Independent count: every top-level entry opens a brace on its own line.
  const expected = [...source.matchAll(/^ {2}"?[a-z0-9-]+"?: \{$/gm)].length;
  assert.equal(ids.length, expected, "parser sees every entry");
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
});

test("a lesson may append glossary terms but not remove one another lesson uses", async () => {
  const base = await readFile(path.join(repoRoot, "lib/glossary.ts"), "utf8");
  const baseIds = await glossaryIds(base);

  // Anchor at the end of file: the GlossaryEntry type also closes with "};".
  const appended = base.replace(
    /};\s*$/,
    '  "state-transition": {\n    title: "State transition",\n    definition: "A signed change.",\n  },\n};\n',
  );
  const afterAppend = await glossaryIds(appended);
  assert.ok(afterAppend.includes("state-transition"), "new id is picked up");
  assert.deepEqual(baseIds.filter((id) => !afterAppend.includes(id)), [], "appending removes nothing");

  const removed = base.replace(/^ {2}ico: \{[\s\S]*?^ {2}\},$/m, "");
  const afterRemove = await glossaryIds(removed);
  assert.deepEqual(baseIds.filter((id) => !afterRemove.includes(id)), ["ico"], "deletion is detectable");
});

test("command kills a hung child instead of stalling the run", async () => {
  const started = Date.now();
  const result = await command("node", ["-e", "setTimeout(() => {}, 60_000)"], { timeoutMs: 500 });
  assert.equal(result.timedOut, true, "timeout is reported");
  assert.notEqual(result.code, 0, "a killed child does not look successful");
  assert.ok(Date.now() - started < 10_000, "returned promptly rather than waiting for the child");
});

test("a child that exits without reading stdin does not crash the orchestrator", async () => {
  // Reproduces the EPIPE that killed a run mid-flight: child.once("error") covers the ChildProcess,
  // not the stdin socket, so an unhandled error event took down the whole process.
  const big = "x".repeat(4 * 1024 * 1024);
  const result = await command("node", ["-e", "process.exit(3)"], { input: big });
  assert.equal(result.code, 3, "the child's exit code is still reported");
});

test("validation demands a real verification component, not the challenge id in prose", () => {
  const id = "register-a-username";
  // The old substring check passed on this; it ships no checkpoint at all.
  assert.equal(usesComponent(`Your challenge is ${id}, good luck.`, VERIFICATION_COMPONENTS, id), false);
  assert.equal(usesComponent(`<TestnetVerifier challengeId="${id}" operation="dpns-register" />`, VERIFICATION_COMPONENTS, id), true);
  // Wired to the wrong lesson's challenge.
  assert.equal(usesComponent(`<TestnetVerifier challengeId="submit-a-document" />`, VERIFICATION_COMPONENTS, id), false);
  // A component that merely starts with the same characters must not count.
  assert.equal(usesComponent(`<TestnetVerifierMock challengeId="${id}" />`, VERIFICATION_COMPONENTS, id), false);
  // Props spanning lines, and quiz props full of braces and quotes, still parse.
  assert.equal(usesComponent(`<TestnetVerifier\n  challengeId="${id}"\n  operation="dpns-register"\n/>`, VERIFICATION_COMPONENTS, id), true);
  assert.equal(usesComponent(`<LessonQuiz challengeId="q" questions={[{ id: "a", label: "x > y" }]} />`, ["LessonQuiz"], "q"), true);
});

test("lesson validation requires the quiz but leaves length to editorial review", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "academy-validator-"));
  const lesson = {
    slug: "sample", module: 1, title: "Sample", description: "Example",
    tier: "concepts", estimatedMinutes: 1, exp: 100,
    verification: { kind: "quiz", challengeId: "sample" },
  };
  const frontmatter = `---\ntitle: Sample\ndescription: Example\nmodule: 1\ntier: concepts\nestimatedMinutes: 1\nexp: 100\n---\n`;
  const prose = "A payment arrives before a miner includes it in a block. ".repeat(8);
  const quiz = '<LessonQuiz challengeId="sample" />';
  const mdxPath = path.join(cwd, "content/academy/sample.mdx");
  try {
    await mkdir(path.dirname(mdxPath), { recursive: true });
    await mkdir(path.join(cwd, "lesson-factory/lessons/sample"), { recursive: true });
    await writeFile(path.join(cwd, "lesson-factory/lessons/sample/evidence.json"), JSON.stringify({ slug: "sample", module: 1 }));

    await writeFile(mdxPath, frontmatter + prose + quiz);
    assert.deepEqual(await validateLesson(lesson, cwd), []);

    await writeFile(mdxPath, frontmatter + "Too short.\n" + quiz);
    assert.deepEqual(await validateLesson(lesson, cwd), []);
    assert.match(checkLength(lesson, frontmatter + "Too short.\n" + quiz), /Do not pad/);

    await writeFile(mdxPath, frontmatter + prose);
    assert.deepEqual(await validateLesson(lesson, cwd), ['Missing <LessonQuiz challengeId="sample">']);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("lessons finish in module order and stop at a blocked or failed draft", async () => {
  const lessons = [{ module: 3 }, { module: 1 }, { module: 2 }, { module: 1 }];
  assert.deepEqual(orderedLessons(lessons).map((item) => item.module), [1, 2, 3]);
  for (const stopped of ["blocked", "failed"]) {
    const events = [];
    await runSequentially(lessons, async (lesson) => {
      events.push(`start ${lesson.module}`);
      await Promise.resolve();
      events.push(`end ${lesson.module}`);
      return lesson.module === 2 ? stopped : "passed";
    });
    assert.deepEqual(events, ["start 1", "end 1", "start 2", "end 2"]);
  }
});

test("previous context reads the latest checkout and marks missing lessons without reading later ones", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "academy-context-"));
  try {
    await mkdir(path.join(cwd, "content/academy"), { recursive: true });
    const file = path.join(cwd, "content/academy/first.mdx");
    await writeFile(file, "First draft");
    const manifest = { lessons: [{ module: 1, slug: "first" }, { module: 2, slug: "missing" }, { module: 3, slug: "current" }, { module: 4, slug: "later" }] };
    await writeFile(file, "Reviewed rewrite");
    const context = await previousLessons(manifest, manifest.lessons[2], cwd);
    assert.equal(context.length, 2);
    assert.equal(context[0].text, "Reviewed rewrite");
    assert.equal(context[1].missing, true);
    for (const role of ["research", "author", "revision", "facts-review", "pedagogy-review"]) {
      assert.match(buildPrompt(role, manifest.lessons[2], { previousLessons: context }), /Reviewed rewrite/);
    }
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("a pedagogy pass needs demonstrated reader reasoning, not only a verdict", () => {
  const result = { verdict: "pass", findings: [] };
  assert.throws(() => validateStageOutput("review", result, "pedagogy-review"), /reader reasoning/);
  result.readerReview = { reasoningChain: ["Ownership needs authorization"], transferQuestion: "Who may edit?", answer: "The owner", supportingPassages: ["Who can change the profile?"], coverageGaps: [], continuityGaps: [] };
  assert.doesNotThrow(() => validateStageOutput("review", result, "pedagogy-review"));
  result.readerReview.coverageGaps.push("No worked fee calculation");
  assert.throws(() => validateStageOutput("review", result, "pedagogy-review"), /unresolved teaching gaps/);
});

test("pedagogy prompt reserves gap arrays for unresolved defects", () => {
  const prompt = buildPrompt("pedagogy-review", { module: 8, title: "Wallets, keys, and testnet" }, { previousLessons: [] });
  assert.match(prompt, /only unresolved defects in the gap arrays/);
  assert.match(prompt, /upstream placeholder.*not a continuity gap/);
});

test("a partial draft can resume but cannot pass without both lesson and evidence", () => {
  const lesson = { slug: "sample" };
  const partial = ["content/academy/sample.mdx"];
  assert.doesNotThrow(() => assertAllowedChanges(lesson, partial, { requireAuthored: false }));
  assert.throws(() => assertAllowedChanges(lesson, partial), /evidence ledger/);
  assert.throws(() => assertAllowedChanges(lesson, [...partial, "AGENTS.md"], { requireAuthored: false }), /outside its lesson/);
});

test("checkout lock excludes overlapping commands and releases after failure", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "academy-lock-"));
  const lock = path.join(cwd, "orchestrator.lock");
  try {
    await assert.rejects(withWorkspaceLock(async () => {
      await assert.rejects(withWorkspaceLock(async () => {}, lock), /using this checkout/);
      throw new Error("stage failed");
    }, lock), /stage failed/);
    assert.equal(await withWorkspaceLock(async () => "resumed", lock), "resumed");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("checkout commits leave unrelated staged changes alone and detect both rename paths", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "academy-workspace-"));
  const git = async (...args) => {
    const result = await command("git", args, { cwd });
    assert.equal(result.code, 0, result.stderr);
    return result.stdout;
  };
  try {
    await git("init", "-q");
    await git("config", "user.name", "Fixture");
    await git("config", "user.email", "fixture@example.invalid");
    await writeFile(path.join(cwd, "lesson.mdx"), "initial");
    await writeFile(path.join(cwd, "unrelated.txt"), "initial");
    await git("add", ".");
    await git("commit", "-qm", "Baseline");
    await writeFile(path.join(cwd, "lesson.mdx"), "rewrite");
    await writeFile(path.join(cwd, "unrelated.txt"), "user edit");
    await git("add", "unrelated.txt");
    await commitLesson(cwd, { module: 1, slug: "sample" }, ["lesson.mdx"]);
    assert.equal((await git("show", "HEAD:unrelated.txt")).trim(), "initial");
    assert.match(await git("diff", "--cached"), /user edit/);
    await git("mv", "lesson.mdx", "renamed.mdx");
    const files = await changedFiles(cwd);
    assert.ok(files.includes("lesson.mdx"));
    assert.ok(files.includes("renamed.mdx"));
    assert.ok(files.includes("unrelated.txt"));
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("only a locked opencode database earns another agent run", () => {
  const locked = { code: 1, stderr: "Error: Unexpected error\n\ndatabase is locked" };
  assert.equal(shouldRetryAgent(locked, 1), true);
  assert.equal(shouldRetryAgent(locked, 4), false, "gives up at the limit");
  assert.equal(shouldRetryAgent({ code: 0, stderr: "" }, 1), false, "success is not retried");
  assert.equal(shouldRetryAgent({ code: 1, stderr: "quota exceeded" }, 1), false, "other failures repeat");
});
