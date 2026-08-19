import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { command, lessonKey, repoRoot } from "./lib.mjs";

export async function assertPreparedBaseline() {
  const required = [
    "AGENTS.md", ".gitignore", "package.json", "package-lock.json", "curriculum/lessons.json",
    "lib/progress.ts", "components/lesson/course-track-card.tsx", "components/lesson/lesson-nav-list.tsx",
    ".agents/skills/write-dash-lesson/SKILL.md", ".agents/skills/write-dash-lesson/agents/openai.yaml",
    ".agents/skills/write-dash-lesson/references/workflow.md", "scripts/lessons.mjs",
    "scripts/lesson-factory/lib.mjs", "scripts/lesson-factory/codex.mjs", "scripts/lesson-factory/worktree.mjs",
    "scripts/lesson-factory/validate.mjs", "scripts/lesson-factory/browser.mjs", "scripts/lesson-factory/testnet.mjs",
    "scripts/lesson-factory/README.md", "scripts/lesson-factory/factory.test.mjs",
    "scripts/lesson-factory/schemas/research.schema.json", "scripts/lesson-factory/schemas/author.schema.json",
    "scripts/lesson-factory/schemas/review.schema.json"
  ];
  const tracked = await command("git", ["ls-files", "--error-unmatch", ...required], { cwd: repoRoot });
  if (tracked.code !== 0) throw new Error("Lesson-factory infrastructure must be committed before creating worktrees");
  const changes = await command("git", ["diff", "--quiet", "--", ...required], { cwd: repoRoot });
  if (changes.code !== 0) throw new Error("Commit the lesson-factory infrastructure changes before a real run");
  const head = await command("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  return head.stdout.trim();
}

export async function createWorktree({ runId, lesson, baseline }) {
  const root = path.resolve(repoRoot, "../.dash-academy-worktrees", runId);
  const worktree = path.join(root, lessonKey(lesson));
  const branch = `lesson-${runId.slice(-8)}-${String(lesson.module).padStart(2, "0")}`;
  await mkdir(root, { recursive: true });
  const result = await command("git", ["worktree", "add", "-b", branch, worktree, baseline], { cwd: repoRoot });
  if (result.code !== 0) throw new Error(`Could not create worktree: ${result.stderr}`);
  await linkDocs(worktree, baseline);
  await cloneNodeModules(worktree);
  return { worktree, branch };
}

const docsPaths = [
  ".agents/skills/dash-docs/docs",
  ".agents/skills/dash-docs/docs-platform",
  ".agents/skills/dash-docs/platform-book",
];

async function linkDocs(worktree, baseline) {
  for (const relative of docsPaths) {
    const source = path.join(repoRoot, relative);
    const sourceHead = await command("git", ["rev-parse", "HEAD"], { cwd: source });
    const expected = await command("git", ["rev-parse", `${baseline}:${relative}`], { cwd: repoRoot });
    if (sourceHead.code !== 0 || expected.code !== 0 || sourceHead.stdout.trim() !== expected.stdout.trim()) {
      throw new Error(`Local Dash docs checkout does not match the baseline for ${relative}`);
    }
    const target = path.join(worktree, relative);
    await rm(target, { recursive: true, force: true });
    await symlink(source, target, "dir");
  }
}

export async function cloneNodeModules(worktree) {
  const source = path.join(repoRoot, "node_modules");
  try { await lstat(source); } catch { return; }
  const target = path.join(worktree, "node_modules");
  const rootLock = await command("git", ["hash-object", "package-lock.json"], { cwd: repoRoot });
  const treeLock = await command("git", ["hash-object", "package-lock.json"], { cwd: worktree });
  if (rootLock.stdout.trim() !== treeLock.stdout.trim()) return;
  const clone = await command("cp", ["-cR", source, target], { cwd: worktree });
  if (clone.code !== 0) throw new Error(`Could not clone node_modules into the worktree: ${clone.stderr}`);
}

export async function changedFiles(worktree) {
  await assertDocLinks(worktree);
  const result = await command("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=all", "-z", "--", ".",
    ":(exclude)node_modules", ":(exclude)next-env.d.ts",
  ], { cwd: worktree });
  if (result.code !== 0) throw new Error(result.stderr);
  return result.stdout.split("\0").filter(Boolean).map((line) => line.slice(3));
}

async function assertDocLinks(worktree) {
  for (const relative of docsPaths) {
    const target = path.join(worktree, relative);
    let linked;
    try { linked = await readlink(target); } catch { throw new Error(`Dash docs link was altered: ${relative}`); }
    if (path.resolve(path.dirname(target), linked) !== path.join(repoRoot, relative)) throw new Error(`Dash docs link points outside the approved source: ${relative}`);
  }
}

export function assertAllowedChanges(lesson, files) {
  const allowed = new Set([
    `content/academy/${lesson.slug}.mdx`,
    `lesson-sources/${lesson.slug}.json`,
    `tests/lessons/${lesson.slug}.mjs`,
    `tests/lessons/${lesson.slug}.verify.mjs`,
  ]);
  const unexpected = files.filter((file) => !allowed.has(file));
  if (unexpected.length) throw new Error(`Agent changed files outside its lesson: ${unexpected.join(", ")}`);
  if (!files.includes(`content/academy/${lesson.slug}.mdx`)) throw new Error("Author did not produce the lesson MDX");
  if (!files.includes(`lesson-sources/${lesson.slug}.json`)) throw new Error("Author did not produce the evidence ledger");
}

export async function commitLesson(worktree, lesson, files) {
  const add = await command("git", ["add", "--", ...files], { cwd: worktree });
  if (add.code !== 0) throw new Error(add.stderr);
  const commit = await command("git", ["commit", "-m", `content(academy): add module ${lesson.module} ${lesson.slug}`], { cwd: worktree });
  if (commit.code !== 0) throw new Error(commit.stderr);
  const sha = await command("git", ["rev-parse", "HEAD"], { cwd: worktree });
  return sha.stdout.trim();
}
