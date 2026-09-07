import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { command, glossaryIds, repoRoot, runRoot } from "./lib.mjs";

export async function withWorkspaceLock(task, lockPath = path.join(runRoot, "orchestrator.lock")) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Another lesson command is using this checkout"); throw error; }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await task();
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

export async function assertPreparedBaseline() {
  const required = [
    "AGENTS.md", ".gitignore", "package.json", "package-lock.json",
    "lib/progress/index.ts", "components/lesson/course-track-card.tsx", "components/lesson/lesson-nav-list.tsx",
    ".agents/skills/write-dash-lesson/SKILL.md", ".agents/skills/write-dash-lesson/agents/openai.yaml",
    ".agents/skills/write-dash-lesson/references/workflow.md",
    ".agents/skills/anti-ai-slop-writing/SKILL.md", ".agents/skills/anti-ai-slop-writing/references/banned-words.md",
  ];
  const factory = await command("git", ["ls-files", "--", "lesson-factory"], { cwd: repoRoot });
  const factoryFiles = factory.stdout.trim().split("\n").filter(Boolean);
  const untracked = await command("git", ["ls-files", "--others", "--exclude-standard", "--", "lesson-factory"], { cwd: repoRoot });
  if (untracked.stdout.trim()) throw new Error("Lesson-factory infrastructure must be committed before starting a run");
  const tracked = await command("git", ["ls-files", "--error-unmatch", ...required, ...factoryFiles], { cwd: repoRoot });
  if (tracked.code !== 0) throw new Error("Lesson-factory infrastructure must be committed before starting a run");
  const changes = await command("git", ["diff", "--quiet", "HEAD", "--", ...required, ...factoryFiles], { cwd: repoRoot });
  if (changes.code !== 0) throw new Error("Commit the lesson-factory infrastructure changes before a real run");
  const dirty = await changedFiles(repoRoot);
  if (dirty.length) throw new Error(`Start from a clean checkout; preserve or commit these files first: ${dirty.join(", ")}`);
  const head = await command("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  if (head.code !== 0) throw new Error(head.stderr);
  await assertDocsBaseline();
  return head.stdout.trim();
}

export async function assertDocsBaseline() {
  for (const relative of [".agents/skills/dash-docs/docs", ".agents/skills/dash-docs/docs-platform", ".agents/skills/dash-docs/platform-book"]) {
    const cwd = path.join(repoRoot, relative);
    const actual = await command("git", ["rev-parse", "HEAD"], { cwd });
    const expected = await command("git", ["rev-parse", `HEAD:${relative}`]);
    const dirty = await command("git", ["status", "--porcelain", "--untracked-files=no"], { cwd });
    if (actual.code !== 0 || expected.code !== 0 || dirty.code !== 0 || actual.stdout.trim() !== expected.stdout.trim() || dirty.stdout.trim()) throw new Error(`Dash docs do not match the committed baseline: ${relative}`);
  }
}

export async function changedFiles(worktree) {
  const result = await command("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=all", "-z", "--", ".",
    ":(exclude)node_modules", ":(exclude)next-env.d.ts",
  ], { cwd: worktree });
  if (result.code !== 0) throw new Error(result.stderr);
  const entries = result.stdout.split("\0").filter(Boolean);
  const files = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    files.push(entry.slice(3));
    // A rename has a second, unprefixed path; both sides must be within the lesson allowlist.
    if (/[RC]/.test(entry.slice(0, 2))) files.push(entries[++index]);
  }
  return [...new Set(files)];
}

// Earlier lessons may still refer to any of these ids.
export async function assertGlossaryOnlyGrew(worktree) {
  const before = await command("git", ["show", "HEAD:lib/glossary.ts"], { cwd: worktree });
  if (before.code !== 0) throw new Error("Could not read the baseline glossary");
  const [baseline, current] = await Promise.all([
    glossaryIds(before.stdout),
    glossaryIds(await readFile(path.join(worktree, "lib/glossary.ts"), "utf8")),
  ]);
  const removed = baseline.filter((id) => !current.includes(id));
  if (removed.length) throw new Error(`Agent removed glossary terms other lessons may use: ${removed.join(", ")}`);
}

export function assertAllowedChanges(lesson, files, { requireAuthored = true } = {}) {
  const allowed = new Set([
    `content/academy/${lesson.slug}.mdx`,
    `lesson-factory/lessons/${lesson.slug}/evidence.json`,
    `lesson-factory/lessons/${lesson.slug}/fixture.mjs`,
    `lesson-factory/lessons/${lesson.slug}/verify.mjs`,
    "lib/glossary.ts",
  ]);
  const unexpected = files.filter((file) => !allowed.has(file));
  if (unexpected.length) throw new Error(`Agent changed files outside its lesson: ${unexpected.join(", ")}`);
  if (!requireAuthored) return;
  if (!files.includes(`content/academy/${lesson.slug}.mdx`)) throw new Error("Author did not produce the lesson MDX");
  if (!files.includes(`lesson-factory/lessons/${lesson.slug}/evidence.json`)) throw new Error("Author did not produce the evidence ledger");
}

export async function commitLesson(worktree, lesson, files) {
  const add = await command("git", ["add", "--", ...files], { cwd: worktree });
  if (add.code !== 0) throw new Error(add.stderr);
  const commit = await command("git", ["commit", "--only", "-m", `content(academy): write module ${lesson.module} ${lesson.slug}`, "--", ...files], { cwd: worktree });
  if (commit.code !== 0) throw new Error(commit.stderr);
  const sha = await command("git", ["rev-parse", "HEAD"], { cwd: worktree });
  return sha.stdout.trim();
}
