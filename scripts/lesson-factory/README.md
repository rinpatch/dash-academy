# Lesson factory operator runbook

This factory researches, authors, tests, independently reviews, and commits the fixed 17-module Dash Academy curriculum. Each lesson runs on its own branch and Git worktree. Git MDX plus its evidence ledger are the source of truth; Notion is reference input only.

Read the repository [`AGENTS.md`](../../AGENTS.md) before operating the factory. Lesson agents are instructed through [`write-dash-lesson`](../../.agents/skills/write-dash-lesson/SKILL.md) and must use the vendored [`dash-docs`](../../.agents/skills/dash-docs/SKILL.md) sources. The fixed scope, ordering, verification type, and challenge IDs live in [`curriculum/lessons.json`](../../curriculum/lessons.json).

## Safety model

- Research, authoring, review, deterministic tests, builds, and browsers are secretless.
- Never keep `.env.local`, `.issuer-identity.local.json`, a mnemonic, or private signing material in this checkout while agents or browser servers are running.
- Agents may change only their assigned MDX, evidence ledger, deterministic fixture, and independent verifier. The runner enforces this allowlist and creates the commit only after all local gates pass.
- Tier 2 live writes are a separate trusted phase. They require all agents and dev servers to be stopped, an external signer outside the repository, and explicit spending caps.
- Generated run state, browser artifacts, worktrees, and secret material are never committed.

## One-time setup

The verified development environment uses Node 24, opencode 1.17 or newer, `portless` 0.15.5, and `agent-browser` 0.34.0. The latter two are exactly pinned in `package-lock.json` and are always invoked from `node_modules`, not a potentially older global installation.

```sh
git submodule update --init --recursive
npm ci
opencode --version
opencode auth list           # needs a provider with credit; see "Model" below
node_modules/.bin/agent-browser doctor
npm run lessons -- preflight
npm run lessons:test
```

### Model

Every role runs `opencode run` with `tokenrouter/anthropic/claude-sonnet-5`. Override with
`LESSON_MODEL=provider/model`. Research runs at `--variant high`; other roles use the default effort.

TokenRouter is a custom provider defined in `~/.config/opencode/opencode.jsonc`. It is wired through
`@ai-sdk/anthropic` against `https://api.tokenrouter.com/v1`, not `@ai-sdk/openai-compatible`: on
TokenRouter the Anthropic models are served from the native `/v1/messages` endpoint, and going
through the chat-completions shim would drop prompt caching and thinking blocks.

Read-only roles (research, facts-review, pedagogy-review) run with `OPENCODE_PERMISSION` denying
`edit` and `bash`; author and revision run with `--auto` and write access to their worktree.
opencode has no `--output-schema`, so the schema is embedded in the prompt and the final assistant
message is parsed and validated by `validateStageOutput`.

The three Dash documentation submodules must match the commits recorded by the current Git baseline. The worktree setup checks this before giving an agent access to them.

Browser tests share one loopback-only HTTPS Portless proxy. Trust its local CA once, then start it explicitly on the non-privileged port expected by the runner:

```sh
node_modules/.bin/portless trust
node_modules/.bin/portless proxy start -p 1355 --https
node_modules/.bin/portless doctor
```

`portless trust` changes the machine trust store and should be run deliberately. Do not probe mutating Portless subcommands with `--help`: releases in the pinned pre-1.0 line may still execute the subcommand. Never enable LAN, tunnel, funnel, or wildcard exposure for lesson servers.

Commit lesson-factory infrastructure before starting a real run. The runner accepts unrelated untracked files, but refuses uncommitted changes to its required infrastructure because newly created worktrees must all start from an exact commit.

## Run the curriculum

Start one tier or one module:

```sh
npm run lessons -- run --tier 1 --concurrency 3
npm run lessons -- run --tier 2 --concurrency 3
npm run lessons -- run --module 10
```

The safe default concurrency is three lesson workers. Browser suites are independently capped at two, and live testnet writers are serialized to one. A lesson moves through:

```text
pending → researching → blocked | authoring → testing → reviewing
        → revising (at most twice) → passed | local-passed | failed
```

Tier 1 ends at `passed`. A secretless Tier 2 run ends at `local-passed`, meaning content, fixtures, lint, build, three browsers, and both reviews passed, but no testnet write has been claimed.

### Status and artifacts

```sh
npm run lessons -- status
npm run lessons -- status --json
npm run lessons -- questions
npm run lessons -- questions --json
```

Commands use the latest run unless `--run-id <id>` is supplied. Durable, ignored state lives under:

```text
.lesson-runs/<run-id>/
├── run.json                         # baseline, worktrees, status, commits, summaries
└── lessons/<NN-slug>/
    ├── research.json                # sources, claims, uncertainties, outline
    ├── author.json / revision.json  # structured author result
    ├── facts-review.json
    ├── pedagogy-review.json
    ├── events/*.jsonl               # complete opencode JSONL event transcript after a role exits
    ├── stderr/*.log                 # redacted agent diagnostics
    └── tests/
        ├── browser/                 # server log, screenshots, snapshots/results
        └── testnet.json             # public-only trusted live report, when run
```

`run.json` is the live status source. Agent event streams are written after that role exits, so a currently-running role may show only its stage until completion.

### Human questions

Material uncertainty blocks only that lesson. Review the exact source conflict and record a stable answer:

```sh
npm run lessons -- questions
npm run lessons -- answer 9 --question <question-id> --text '<decision>'
npm run lessons -- resume --tier 2 --run-id <run-id>
```

With no `--text`, `answer` prompts interactively. Answers are stored in the ignored run state and included in later author and reviewer context.

### Resume after interruption or failure

```sh
npm run lessons -- resume --tier 1 --run-id <run-id>
npm run lessons -- resume --tier 2 --run-id <run-id>
```

The runner reuses completed research, authored files, worktrees, and commits instead of starting successful stages again. Failed worktrees are preserved for inspection.

Only one orchestrator may run at a time. If the process was forcibly killed, inspect `.lesson-runs/orchestrator.lock`; remove it only after confirming its recorded PID no longer exists. Never remove a live lock.

Exit status `0` means all selected lessons reached `passed` or `local-passed`, `2` means a human question blocked progress, and `1` means configuration, test, review, or runner failure.

### Re-run checks

```sh
npm run lessons -- validate --tier 1
npm run lessons -- validate --module 10
npm run lessons -- test 10
npm run lessons -- test 10 --browser
```

The local lesson gate validates manifest/frontmatter/evidence consistency, executes the lesson fixture, lints the repository, builds the production app, and drives three isolated browser instances: desktop, a fresh-storage isolation check, and a 390px mobile viewport. Each worktree owns its Next.js process and Portless route; named browser sessions prevent cookie and storage leakage between lessons.

## Trusted Tier 2 live phase

Do not start this phase merely because local lessons passed. First stop every agent process and lesson dev server, confirm secret-bearing files are outside the checkout, review the lesson fixture and its `.verify.mjs` peer, and configure a separately reviewed signer executable.

Required variables:

```sh
export DASH_TESTNET_LIVE=1
export DASH_TESTNET_SIGNER_COMMAND=/absolute/path/to/reviewed-signer
export DASH_TESTNET_RESERVE_CREDITS=<positive-integer>
export DASH_TESTNET_MAX_RUN_CREDITS=<positive-integer>
export DASH_TESTNET_MAX_LESSON_CREDITS=<positive-integer>
export DASH_TESTNET_MAX_TRANSITION_FEE_CREDITS=<positive-integer>
```

The signer owns the issuer key and must independently enforce the same reserve and spending policy. It receives exactly one JSON request on stdin and emits one public JSON response on stdout:

- `{"action":"status","network":"testnet"}` → `{"balanceCredits":"..."}`
- `{"action":"fund",...}` → `{"status":"funded","reference":"..."}`

The runner never loads the issuer mnemonic and never passes the signer path or issuer material to learner code. An SDK fixture started with `--live-protocol` emits one `funding-request`, waits for one `funding-result`, performs the assigned operation with a disposable actor, and emits one public `result`. Its `.verify.mjs` peer receives only that public result and checks it independently with proof-enabled `@dashevo/wasm-sdk`.

Run one reviewed lesson first, then the tier:

```sh
npm run lessons -- test 10 --live --run-id <run-id>
npm run lessons -- resume --tier 2 --live --run-id <run-id>
```

All live writes share a lock in the repository’s Git common directory. Funding and observed treasury spend are checked against per-lesson, per-run, fee-headroom, and reserve limits. Lesson fixtures and verifiers run unsandboxed, with the privileges of the user running the factory.

## Integrate passing lessons

Integration never mutates the operator’s branch. It creates a local integration branch and worktree from the captured run baseline, cherry-picks lesson commits in module order, regenerates `content/academy/meta.json`, and runs lint plus a production build.

```sh
npm run lessons -- integrate --tier 1 --run-id <run-id>
npm run lessons -- integrate --tier 2 --run-id <run-id>
```

Integration refuses any selected lesson that is not `passed`; `local-passed` is intentionally insufficient for Tier 2. Tier 2 navigation retains validated Tier 1 prerequisites from the baseline and admits no stale or unpassed Tier 2 page. The command prints the created branch and worktree path. Review that branch before merging or cherry-picking it into another branch.

## Handoff checklist

Another coding session can take over without conversational context by doing the following:

1. Read `AGENTS.md`, this runbook, the lesson skill, and the curriculum manifest.
2. Run `git status`, `npm run lessons -- preflight`, and `npm run lessons -- status --json`.
3. Confirm the Portless proxy is healthy before resuming any browser stage.
4. Inspect `questions` and the latest lesson review/test artifacts.
5. Resume the exact run ID; do not start a replacement run unless the existing run is intentionally abandoned.
6. Keep the local and trusted live phases separate, and never infer `passed` from `local-passed`.
7. Integrate only after every selected module is proven passing, then run the repository-wide validation, fixture suite, lint, build, and browser audit appropriate to the final branch.
