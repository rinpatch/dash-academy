import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { glossaryIds, loadManifest, secretlessEnv, selectIntegrationPages, validateManifest } from "./lib.mjs";
import { command, repoRoot } from "./lib.mjs";
import { formatEvent, parseResult } from "./agent.mjs";
import { usesComponent, VERIFICATION_COMPONENTS } from "./validate.mjs";

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
  assert.equal(manifest.lessons.length, 17);
  assert.deepEqual(manifest.lessons.map((lesson) => lesson.module), Array.from({ length: 17 }, (_, index) => index + 1));
});

test("manifest validation rejects duplicate modules", async () => {
  const manifest = structuredClone(await loadManifest());
  manifest.lessons[1].module = 1;
  assert.throws(() => validateManifest(manifest), /duplicate module/);
});

test("Tier 2 integration retains valid prerequisite pages without admitting stale later pages", async () => {
  const lessons = (await loadManifest()).lessons;
  const runLessons = Object.fromEntries(lessons.map((lesson) => [lesson.module, {
    status: lesson.module >= 8 ? "passed" : "pending",
  }]));
  const pages = selectIntegrationPages({
    lessons,
    tier: 2,
    runLessons,
    validPrerequisiteModules: new Set([1, 2, 3, 4, 5, 6, 7]),
  });
  assert.deepEqual(pages, lessons.map((lesson) => lesson.slug));

  runLessons[10].status = "pending";
  const withoutUnpassedTier2Page = selectIntegrationPages({
    lessons,
    tier: 2,
    runLessons,
    validPrerequisiteModules: new Set([1, 2, 3, 4, 5, 6, 7, 10]),
  });
  assert.equal(withoutUnpassedTier2Page.includes(lessons[9].slug), false);
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
