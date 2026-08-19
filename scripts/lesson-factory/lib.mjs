import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

export const repoRoot = path.resolve(import.meta.dirname, "../..");
export const runRoot = path.join(repoRoot, ".lesson-runs");
export const manifestPath = path.join(repoRoot, "curriculum/lessons.json");

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export async function loadManifest() {
  const manifest = await readJson(manifestPath);
  validateManifest(manifest);
  return manifest;
}

export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.lessons)) throw new Error("Unsupported curriculum manifest");
  if (manifest.lessons.length !== 17) throw new Error("Curriculum must contain exactly 17 lessons");
  const modules = new Set();
  const slugs = new Set();
  const challenges = new Set();
  for (const lesson of manifest.lessons) {
    if (!Number.isInteger(lesson.module) || lesson.module < 1 || lesson.module > 17 || modules.has(lesson.module)) throw new Error(`Invalid or duplicate module ${lesson.module}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.slug) || slugs.has(lesson.slug)) throw new Error(`Invalid or duplicate slug ${lesson.slug}`);
    if ((lesson.module <= 7 ? "concepts" : "sdk") !== lesson.tier) throw new Error(`Tier mismatch in module ${lesson.module}`);
    const ids = [lesson.verification.challengeId, lesson.verification.quizChallengeId].filter(Boolean);
    for (const id of ids) {
      if (challenges.has(id)) throw new Error(`Duplicate challenge ID ${id}`);
      challenges.add(id);
    }
    modules.add(lesson.module);
    slugs.add(lesson.slug);
  }
  for (let moduleNumber = 1; moduleNumber <= 17; moduleNumber += 1) if (!modules.has(moduleNumber)) throw new Error(`Missing module ${moduleNumber}`);
  for (const lesson of manifest.lessons) for (const prerequisite of lesson.prerequisites) {
    const dependency = manifest.lessons.find((candidate) => candidate.slug === prerequisite);
    if (!dependency || dependency.module >= lesson.module) throw new Error(`Invalid prerequisite ${prerequisite} for ${lesson.slug}`);
  }
}

export const glossaryPath = path.join(repoRoot, "lib/glossary.ts");

// Term ids are string keys in a Record, so order is irrelevant and entries merge cleanly. Read them
// out of the source rather than keeping a second list that would drift.
export async function glossaryIds(source) {
  const text = source ?? await readFile(glossaryPath, "utf8");
  const body = text.slice(text.indexOf("GLOSSARY: Record<string, GlossaryEntry> = {"));
  return [...body.matchAll(/^ {2}"?([a-z0-9-]+)"?:\s*\{/gm)].map((match) => match[1]);
}

export function lessonKey(lesson) {
  return `${String(lesson.module).padStart(2, "0")}-${lesson.slug}`;
}

export function selectIntegrationPages({ lessons, tier, runLessons, validPrerequisiteModules = new Set() }) {
  return lessons
    .filter((lesson) => {
      if (runLessons[lesson.module]?.status === "passed") return true;
      return tier === 2 && lesson.module <= 7 && validPrerequisiteModules.has(lesson.module);
    })
    .map((lesson) => lesson.slug);
}

export function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export async function command(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    // Without this a hung child stalls the whole run: agent-browser's screenshot --full can hang
    // rather than exit non-zero.
    const timer = options.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), options.timeoutMs) : null;
    child.stdout?.on("data", (chunk) => { stdout += chunk; options.onStdout?.(chunk.toString()); });
    child.stderr?.on("data", (chunk) => { stderr += chunk; options.onStderr?.(chunk.toString()); });
    child.once("error", (error) => { if (timer) clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stdout, stderr, timedOut: signal === "SIGKILL" && Boolean(timer) });
    });
    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    }
  });
}

export function secretlessEnv(extra = {}) {
  const allowed = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TERM", "TMPDIR", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "OPENCODE_CONFIG_DIR"];
  const env = Object.fromEntries(allowed.flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
  return { ...env, ...extra };
}

export function parseArgs(argv) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) { options._.push(token); continue; }
    const key = token.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) { options[key] = next; index += 1; }
    else options[key] = true;
  }
  return options;
}

export async function latestRunId() {
  try { return (await readFile(path.join(runRoot, "latest"), "utf8")).trim(); }
  catch { return null; }
}
