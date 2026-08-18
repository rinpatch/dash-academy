import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { command, repoRoot, secretlessEnv } from "./lib.mjs";

const portless = path.join(repoRoot, "node_modules/.bin/portless");
const browser = path.join(repoRoot, "node_modules/.bin/agent-browser");

export async function browserPreflight() {
  const result = await command(portless, ["doctor"], { env: secretlessEnv() });
  const detail = `${result.stdout}\n${result.stderr}`;
  if (result.code !== 0 || /Proxy is not running/i.test(detail) || !/port 1355/i.test(detail)) {
    throw new Error(`Portless must be running locally with HTTPS on port 1355. Run '${portless} trust' once, then '${portless} proxy start -p 1355 --https'.\n${detail}`);
  }
}

export async function browserTest({ lesson, worktree, runId, lessonDir }) {
  await browserPreflight();
  const artifactDir = path.join(lessonDir, "tests", "browser");
  await mkdir(artifactDir, { recursive: true });
  const serverLog = path.join(artifactDir, "server.log");
  const logHandle = await import("node:fs").then(({ openSync }) => openSync(serverLog, "a", 0o600));
  const server = spawn("npm", ["run", "dev:isolated"], { cwd: worktree, env: secretlessEnv(), stdio: ["ignore", logHandle, logHandle] });
  const sessions = ["desktop", "isolated", "mobile"].map((role) => `${runId}-m${lesson.module}-${role}`.replace(/[^a-zA-Z0-9_-]/g, "-"));
  try {
    const urlResult = await command(portless, ["get", "dash-academy"], { cwd: worktree, env: secretlessEnv() });
    if (urlResult.code !== 0) throw new Error(urlResult.stderr);
    const url = `${urlResult.stdout.trim()}/learn/${lesson.slug}`;
    await waitForPage(url, server);
    const results = [];
    for (let index = 0; index < sessions.length; index += 1) {
      const session = sessions[index];
      await ab(session, ["open", "about:blank"]);
      await ab(session, index === 2 ? ["set", "viewport", "390", "844"] : ["set", "viewport", "1440", "1000"]);
      await ab(session, ["open", url]);
      await ab(session, ["wait", "h1"]);
      if (index === 0) await ab(session, ["storage", "local", "set", "lesson-factory-isolation", session]);
      if (index === 1) {
        const isolatedStorage = await ab(session, ["storage", "local", "get", "lesson-factory-isolation"]);
        if (!/null\s*$/i.test(isolatedStorage.stdout.trim())) throw new Error("Browser sessions shared localStorage unexpectedly");
      }
      const title = await ab(session, ["get", "title"]);
      const snapshot = await ab(session, ["snapshot", "--json"]);
      const errors = await ab(session, ["errors", "--json"]);
      const consoleOutput = await ab(session, ["console", "--json"]);
      if (index === 2) {
        const overflow = await ab(session, ["eval", "document.documentElement.scrollWidth <= window.innerWidth"]);
        if (overflow.stdout.trim() !== "true") throw new Error("Lesson has horizontal overflow at 390px");
      }
      await ab(session, ["screenshot", path.join(artifactDir, `${index === 0 ? "desktop" : index === 1 ? "isolated" : "mobile"}.png`), "--full-page"]);
      results.push({ session, title: title.stdout.trim(), snapshot: parseMaybeJson(snapshot.stdout), errors: parseMaybeJson(errors.stdout), console: parseMaybeJson(consoleOutput.stdout) });
    }
    const bad = results.filter((result) => containsErrors(result.errors) || containsErrors(result.console));
    await writeFile(path.join(artifactDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`, { mode: 0o600 });
    if (bad.length) throw new Error(`Browser errors in ${bad.map((entry) => entry.session).join(", ")}`);
    return { passed: true, url, sessions };
  } finally {
    await Promise.allSettled(sessions.map((session) => ab(session, ["close"])));
    server.kill("SIGTERM");
    if (server.exitCode === null) await Promise.race([
      new Promise((resolve) => server.once("close", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}

async function ab(session, args) {
  const result = await command(browser, ["--session", session, ...args], { env: secretlessEnv() });
  if (result.code !== 0) throw new Error(`agent-browser ${args.join(" ")} failed: ${result.stderr}`);
  return result;
}

async function waitForPage(url, server) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Dev server exited before it became ready");
    const response = await command("curl", ["--fail", "--silent", "--show-error", "--max-time", "3", url], { env: secretlessEnv() });
    if (response.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function parseMaybeJson(value) { try { return JSON.parse(value); } catch { return value; } }
function containsErrors(value) {
  if (Array.isArray(value)) return value.some((entry) => /error|failed/i.test(JSON.stringify(entry)));
  return typeof value === "string" && /(?:uncaught|console\.error|failed to)/i.test(value);
}
