import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { command, readJson, repoRoot, secretlessEnv } from "./lib.mjs";

const schemaDir = path.join(repoRoot, "scripts/lesson-factory/schemas");

export async function runCodex({ role, lesson, cwd, lessonDir, context = {}, attempt = 1 }) {
  const writable = role === "author" || role === "revision";
  const schemaName = role === "research" ? "research" : writable ? "author" : "review";
  const output = path.join(lessonDir, `${role}.json`);
  const events = path.join(lessonDir, "events", `${role}-attempt-${attempt}.jsonl`);
  const stderrFile = path.join(lessonDir, "stderr", `${role}-attempt-${attempt}.log`);
  await mkdir(path.dirname(events), { recursive: true });
  await mkdir(path.dirname(stderrFile), { recursive: true });

  const prompt = buildPrompt(role, lesson, context);
  const model = role === "pedagogy-review" ? "gpt-5.6-terra" : "gpt-5.6-sol";
  const args = [
    "exec", "--ephemeral", "--json", "-C", cwd,
    "-s", writable ? "workspace-write" : "read-only",
    "-m", model, "-c", `model_reasoning_effort=${role === "research" ? '"high"' : '"medium"'}`,
    "-c", "web_search=live", "--output-schema", path.join(schemaDir, `${schemaName}.schema.json`),
    "-o", output, "-",
  ];
  const result = await command("codex", args, { cwd, env: secretlessEnv(), input: prompt });
  await writeFile(events, result.stdout, { mode: 0o600 });
  await writeFile(stderrFile, redact(result.stderr), { mode: 0o600 });
  if (result.code !== 0) throw new Error(`${role} agent failed (see ${stderrFile})`);
  const parsed = await readJson(output);
  validateStageOutput(schemaName, parsed);
  return parsed;
}

function buildPrompt(role, lesson, context) {
  const common = `Use $write-dash-lesson. You are the ${role} for exactly module ${lesson.module}: ${lesson.title}.\nManifest row:\n${JSON.stringify(lesson, null, 2)}\n`;
  if (role === "research") return `${common}\nResearch independently. Read the repository instructions and authoritative Dash sources. Do not edit files. Return only the schema result. Material uncertainty must be blocking.`;
  if (role === "author") return `${common}\nApproved research and answers:\n${JSON.stringify(context, null, 2)}\nWrite only content/academy/${lesson.slug}.mdx, lesson-sources/${lesson.slug}.json, tests/lessons/${lesson.slug}.mjs, and tests/lessons/${lesson.slug}.verify.mjs. The verifier must use the independent WASM SDK and only public learner output. Do not commit. Return only the schema result.`;
  if (role === "revision") return `${common}\nRepair only the assigned lesson files using these review findings and test reports:\n${JSON.stringify(context, null, 2)}\nDo not commit. Return only the schema result.`;
  return `${common}\nResearch, answers, diff, and tests:\n${JSON.stringify(context, null, 2)}\nReview independently. Do not edit files. Return only the schema result.`;
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
