import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { latestRunId, runRoot } from "./lib.mjs";

function scanEvents(file) {
  const out = { turns: 0, tools: 0, in: 0, out: 0, last: "", error: "" };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "step_finish") {
      out.turns += 1;
      out.in += e.part?.tokens?.input ?? 0;
      out.out += e.part?.tokens?.output ?? 0;
    }
    if (e.type === "tool_use" && e.part?.state?.status === "completed") {
      out.tools += 1;
      const i = e.part.state.input ?? {};
      out.last = `${e.part.tool} ${String(i.filePath ?? i.pattern ?? i.command ?? i.query ?? "").split("/").pop() ?? ""}`.trim();
    }
    if (e.type === "error") out.error = (e.error?.data?.message ?? e.error?.name ?? "error").slice(0, 60);
  }
  return out;
}

function render(runId) {
  const runDir = path.join(runRoot, runId);
  const state = JSON.parse(readFileSync(path.join(runDir, "run.json"), "utf8"));
  const rows = [];
  for (const item of Object.values(state.lessons).sort((a, b) => a.module - b.module)) {
    if (item.status === "pending" && !item.worktree) continue;
    const dir = path.join(runDir, "lessons", `${String(item.module).padStart(2, "0")}-${item.slug}`, "events");
    let role = "-";
    let stats = { turns: 0, tools: 0, in: 0, out: 0, last: "", error: "" };
    let age = "";
    if (existsSync(dir)) {
      const files = readdirSync(dir).map((f) => path.join(dir, f));
      const newest = files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
      if (newest) {
        role = path.basename(newest, ".jsonl");
        stats = scanEvents(newest);
        age = `${Math.round((Date.now() - statSync(newest).mtimeMs) / 1000)}s`;
      }
    }
    rows.push({ module: String(item.module).padStart(2, "0"), slug: item.slug, status: item.status, role, ...stats, age });
  }
  const pad = (v, n) => String(v).padEnd(n).slice(0, n);
  if (process.stdout.isTTY) console.clear();
  console.log(`run ${runId}   ${new Date().toLocaleTimeString()}\n`);
  console.log(pad("mod", 4) + pad("lesson", 26) + pad("status", 13) + pad("stage", 20) + pad("turns", 6) + pad("tools", 6) + pad("tok in/out", 16) + pad("idle", 6) + "last");
  for (const r of rows) {
    console.log(
      pad(r.module, 4) + pad(r.slug, 26) + pad(r.status, 13) + pad(r.role, 20) +
      pad(r.turns, 6) + pad(r.tools, 6) + pad(`${r.in}/${r.out}`, 16) + pad(r.age, 6) +
      (r.error ? `⚠ ${r.error}` : r.last),
    );
  }
}

// The monitor reads the same durable state as the other CLI commands, so it does not need a
// second entrypoint or its own argument parser.
export async function monitorRun({ runId, watch = false } = {}) {
  const selectedRunId = runId ?? await latestRunId();
  if (!selectedRunId) {
    console.log("No lesson runs yet.");
    return;
  }
  render(selectedRunId);
  if (watch) setInterval(() => render(selectedRunId), 5000);
}
