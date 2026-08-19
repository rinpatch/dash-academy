import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { command } from "./lib.mjs";

export async function validateLesson(lesson, cwd, { complete = false } = {}) {
  const errors = [];
  const mdxPath = path.join(cwd, "content/academy", `${lesson.slug}.mdx`);
  const sourcePath = path.join(cwd, "lesson-sources", `${lesson.slug}.json`);
  let mdx;
  try { mdx = await readFile(mdxPath, "utf8"); } catch { return [`Missing content/academy/${lesson.slug}.mdx`]; }
  let ledger;
  try { ledger = JSON.parse(await readFile(sourcePath, "utf8")); } catch { errors.push(`Missing or invalid lesson-sources/${lesson.slug}.json`); }

  const frontmatter = parseFrontmatter(mdx);
  for (const key of ["title", "description", "module", "tier", "estimatedMinutes", "exp"]) {
    if (String(frontmatter[key]) !== String(lesson[key])) errors.push(`Frontmatter ${key} does not match manifest`);
  }
  if (!mdx.includes("## Learning objectives")) errors.push("Missing ## Learning objectives");
  if (!mdx.includes("## Checkpoint")) errors.push("Missing ## Checkpoint");
  if (!mdx.includes("## What you accomplished")) errors.push("Missing ## What you accomplished");
  if (/^# /m.test(mdx.replace(/^---[\s\S]*?---/, ""))) errors.push("Lesson body must not contain an H1");
  if (/\b(?:mnemonic|private[_ -]?key)\s*[:=]\s*["'][^"']+/i.test(mdx)) errors.push("Possible secret in MDX");
  const expectedIds = [lesson.verification.challengeId, lesson.verification.quizChallengeId].filter(Boolean);
  for (const id of expectedIds) if (!mdx.includes(id)) errors.push(`Missing challenge ID ${id}`);
  if (ledger) {
    if (ledger.slug !== lesson.slug || ledger.module !== lesson.module) errors.push("Evidence ledger identity does not match manifest");
    const sourceIds = new Set((ledger.sources ?? []).map((source) => source.id));
    for (const claim of ledger.claims ?? []) for (const id of claim.sourceIds ?? []) if (!sourceIds.has(id)) errors.push(`Claim references missing source ${id}`);
    if ((ledger.conflicts ?? []).some((conflict) => conflict.status === "blocked")) errors.push("Evidence ledger has a blocked conflict");
  }
  if (complete && lesson.tier === "sdk") {
    try { await access(path.join(cwd, "tests/lessons", `${lesson.slug}.mjs`)); }
    catch { errors.push(`Missing executable fixture tests/lessons/${lesson.slug}.mjs`); }
    try { await access(path.join(cwd, "tests/lessons", `${lesson.slug}.verify.mjs`)); }
    catch { errors.push(`Missing independent verifier tests/lessons/${lesson.slug}.verify.mjs`); }
  }
  return errors;
}

export async function deterministicTests(lesson, cwd) {
  const reports = [];
  for (const [name, args] of [
    ["fixture", ["--test", `tests/lessons/${lesson.slug}.mjs`]],
    ["lint", ["run", "lint"]],
    ["build", ["run", "build"]],
  ]) {
    if (name === "fixture") {
      try { await access(path.join(cwd, "tests/lessons", `${lesson.slug}.mjs`)); }
      catch { continue; }
    }
    let result = await command(name === "fixture" ? "node" : "npm", args, { cwd });
    // Same known fumadocs flake the integration gate already retries: a cold .next cache fails the
    // first build. Without this the harness blames the author for an environment error.
    if (result.code !== 0 && name === "build" && /fumadocs-mdx:collections\/server/.test(`${result.stdout}\n${result.stderr}`)) {
      result = await command("npm", args, { cwd });
    }
    reports.push({ name, passed: result.code === 0, stdout: result.stdout.slice(-8000), stderr: result.stderr.slice(-8000) });
    if (result.code !== 0) break;
  }
  return reports;
}

function parseFrontmatter(mdx) {
  const match = mdx.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return Object.fromEntries(match[1].split("\n").map((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return null;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (/^\d+$/.test(value)) value = Number(value);
    return [key, value];
  }).filter(Boolean));
}
