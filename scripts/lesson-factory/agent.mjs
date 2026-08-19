import { createWriteStream, writeSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { command, glossaryIds, repoRoot, secretlessEnv, writeJson } from "./lib.mjs";

const schemaDir = path.join(repoRoot, "scripts/lesson-factory/schemas");
const skillPath = ".agents/skills/write-dash-lesson/SKILL.md";
// one model for every role, override with LESSON_MODEL. Split per role only if a
// stage's quality measurably lags.
const model = process.env.LESSON_MODEL ?? "tokenrouter-oai/deepseek/deepseek-v4-pro-0813";

export async function runAgent({ role, lesson, cwd, lessonDir, context = {}, attempt = 1 }) {
  const writable = role === "author" || role === "revision";
  const schemaName = role === "research" ? "research" : writable ? "author" : "review";
  const output = path.join(lessonDir, `${role}.json`);
  const events = path.join(lessonDir, "events", `${role}-attempt-${attempt}.jsonl`);
  const stderrFile = path.join(lessonDir, "stderr", `${role}-attempt-${attempt}.log`);
  await mkdir(path.dirname(events), { recursive: true });
  await mkdir(path.dirname(stderrFile), { recursive: true });

  const schema = await readFile(path.join(schemaDir, `${schemaName}.schema.json`), "utf8");
  const vocabulary = role === "research" ? "" : `\nGlossary ids already defined for <Term> (reuse one where it fits; you may append new entries to lib/glossary.ts, but never remove or reword an existing one):\n${(await glossaryIds()).join(", ")}\n`;
  const prompt = `${buildPrompt(role, lesson, context)}\n${vocabulary}\nYour final message must be a single JSON object matching this JSON Schema. No prose, no markdown fences, nothing else.\n${schema}`;
  // opencode has no --output-schema and no path-scoped sandbox; permissions are the read-only gate
  // and the final assistant message is the structured result.
  // The Dash docs are symlinked into each worktree, so following one leaves --dir and opencode
  // treats it as an external directory. Its default effect is "ask", which a non-interactive run
  // turns into a reject: agents silently lost every doc read and returned research with no sources.
  const docs = { [path.join(repoRoot, ".agents/skills/dash-docs/**")]: "allow", "*": "deny" };
  const permission = writable
    ? { edit: "allow", bash: "allow", webfetch: "allow", external_directory: docs }
    : { edit: "deny", bash: "deny", webfetch: "allow", external_directory: docs };
  const args = [
    "run", "--dir", cwd, "--format", "json", "-m", model,
    ...(role === "research" ? ["--variant", "high"] : []),
    ...(writable ? ["--auto"] : []),
  ];
  // Stream events to disk as they arrive so a stuck stage is visible with `tail -f`, and echo a
  // one-line summary per tool call. Writing only after exit hid all progress for the whole stage.
  const stream = createWriteStream(events, { mode: 0o600 });
  let pending = "";
  const started = Date.now();
  const result = await command("opencode", args, {
    cwd,
    env: secretlessEnv({ OPENCODE_PERMISSION: JSON.stringify(permission) }),
    input: prompt,
    onStdout: (chunk) => {
      stream.write(chunk);
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const progress = formatEvent(lesson, role, started, line, cwd);
        if (progress) writeSync(1, `${progress}\n`);
      }
    },
  });
  await new Promise((resolve) => stream.end(resolve));
  await writeFile(stderrFile, redact(result.stderr), { mode: 0o600 });
  if (result.code !== 0) throw new Error(`${role} agent failed (see ${stderrFile})`);
  const parsed = parseResult(result.stdout, role, stderrFile);
  await writeJson(output, parsed);
  validateStageOutput(schemaName, parsed);
  return parsed;
}

// Returns a progress line, or null for events not worth showing. Pure so it is testable without
// stubbing stdout; the caller writes it with writeSync because console.log through a pipe is
// block-buffered and would hide progress until the stage exits.
export function formatEvent(lesson, role, started, line, cwd = "") {
  if (!line.startsWith("{")) return null;
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  const tag = `[m${String(lesson.module).padStart(2, "0")} ${role} +${Math.round((Date.now() - started) / 1000)}s]`;
  if (event.type === "tool_use" && event.part?.state?.status === "completed") {
    const input = event.part.state.input ?? {};
    let detail = String(input.filePath ?? input.pattern ?? input.command ?? input.query ?? "");
    if (cwd && detail.startsWith(cwd)) detail = path.relative(cwd, detail);
    return `${tag} ${event.part.tool} ${detail.slice(0, 90)}`;
  }
  if (event.type === "error") return `${tag} error: ${(event.error?.data?.message ?? event.error?.name ?? "unknown").slice(0, 160)}`;
  if (event.type === "step_finish") {
    const tokens = event.part?.tokens ?? {};
    return `${tag} step done in=${tokens.input ?? 0} out=${tokens.output ?? 0} cost=${event.part?.cost ?? 0}`;
  }
  return null;
}

export function parseResult(stdout, role, stderrFile) {
  let text = "";
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === "error") throw new Error(`${role} agent errored: ${event.error?.data?.message ?? event.error?.name ?? "unknown"}`);
    if (event.type === "text" && event.part?.text?.trim()) text = event.part.text;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`${role} agent returned no JSON object (see ${stderrFile})`);
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch (error) { throw new Error(`${role} agent returned unparseable JSON (see ${stderrFile}): ${error.message}`); }
}

// Every stage is handed the work of the stages before it. Saying so is worth real wall time: the
// author was spending 54 tool calls and 128K input tokens re-reading docs the research stage had
// already distilled into its prompt.
const trustHandoff = "The context below is your input. Do not re-derive it: the lesson files, diff, manifest, and test reports are already here in full, so do not re-read them from disk.";
const verdictBar = "Return verdict revise only for defects in correctness, scope, the audience rule, schema, build, or tests. Report cosmetic issues (formatting, trailing newlines, wording preference) as findings without downgrading the verdict; a revision round is expensive.";

function buildPrompt(role, lesson, context) {
  const common = `Read ${skillPath} and follow it. You are the ${role} for exactly module ${lesson.module}: ${lesson.title}.\nManifest row:\n${JSON.stringify(lesson, null, 2)}\n`;
  if (role === "research") return `${common}\nResearch independently. Read the repository instructions and authoritative Dash sources. Do not edit files. Return only the schema result. Material uncertainty must be blocking.`;
  if (role === "author") return `${common}\nApproved research and answers:\n${JSON.stringify(context, null, 2)}\nThe research above is approved and authoritative. Write from it. Only open a source document when a fact you need is genuinely missing from it, and never to re-verify a claim it already records.\nWrite only content/academy/${lesson.slug}.mdx, lesson-sources/${lesson.slug}.json, tests/lessons/${lesson.slug}.mjs, tests/lessons/${lesson.slug}.verify.mjs, and appended entries in lib/glossary.ts. Important: curriculum prerequisites are slugs, but MDX frontmatter prerequisites must be the corresponding numeric module IDs required by source.config.ts. The verifier must use the independent WASM SDK and only public learner output. You may run the assigned lesson fixture, but do not run repository-wide lint, build, dev-server, or browser commands; the runner owns those gates in its pinned environment. Do not commit. Return only the schema result.`;
  if (role === "revision") return `${common}\nRepair only the assigned lesson files using these review findings and test reports:\n${JSON.stringify(context, null, 2)}\n${trustHandoff} Fix the reported findings and nothing else. A finding usually names one example of a broken rule, not the whole defect: when it does, sweep the file and fix every instance of that rule, or the next review round will simply name the next one.\nYou may run the assigned lesson fixture, but do not run repository-wide lint, build, dev-server, or browser commands; the runner owns those gates in its pinned environment. Do not commit. Return only the schema result.`;
  // facts-review keeps its source access on purpose: checking claims against authoritative Dash
  // docs is the whole point of that gate. pedagogy-review has no such need.
  const scope = role === "facts-review"
    ? `${trustHandoff} You may still open authoritative Dash sources, but only to check a specific claim you actually doubt.`
    : `${trustHandoff} Judging pedagogy needs only the manifest, the skill's audience rule, and the lesson text above, all of which are here.`;
  return `${common}\nResearch, answers, diff, and tests:\n${JSON.stringify(context, null, 2)}\n${scope}\nReview independently. Do not edit files. ${verdictBar} Use block only when a missing human decision or irreconcilable source conflict makes revision impossible. Return only the schema result.`;
}

function redact(value) {
  return value.replace(/\b(?:[a-z]+\s+){11,23}[a-z]+\b/gi, "[REDACTED POSSIBLE MNEMONIC]");
}

function validateStageOutput(kind, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${kind} output is not an object`);
  if (kind === "research") {
    if (!["ready", "blocked"].includes(value.status) || !Array.isArray(value.sources) || !Array.isArray(value.claims) || !Array.isArray(value.uncertainties) || !Array.isArray(value.outline) || !Array.isArray(value.examples)) throw new Error("Research output failed independent validation");
    const sourceIds = new Set(value.sources.map((source) => source.id));
    for (const claim of value.claims) for (const id of claim.sourceIds ?? []) if (!sourceIds.has(id)) throw new Error(`Research claim references unknown source ${id}`);
  } else if (kind === "author") {
    if (!["complete", "blocked"].includes(value.status) || !Array.isArray(value.changedFiles) || !Array.isArray(value.fixtures)) throw new Error("Author output failed independent validation");
  } else if (!["pass", "revise", "block"].includes(value.verdict) || !Array.isArray(value.findings)) throw new Error("Review output failed independent validation");
}
