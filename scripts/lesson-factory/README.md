# Lesson factory

`npm run lessons -- preflight` checks the local tools and committed baseline. `run --module N` creates a lesson worktree, launches an independent research agent, pauses on blocking questions, then authors, validates, browser-tests, reviews, and commits the lesson branch. `questions`, `answer`, `resume`, `status`, `test`, and `integrate` operate on the latest run unless `--run-id` is provided. Tier 2 runs are secretless by default and stop at `local-passed`; use `resume --tier 2 --live` only in the separate trusted phase.

```sh
npm run lessons -- run --tier 1 --concurrency 3
npm run lessons -- run --tier 2 --concurrency 3
npm run lessons -- resume --tier 2 --live
```

Agents never execute live writes. Use `test N --live` only after every Codex and dev-server process has exited, the issuer mnemonic has been moved outside the checkout, and the trusted harness guard variables are present. Live tests are serialized and fail closed when a lesson fixture is absent.

## Live signer boundary

Set `DASH_TESTNET_LIVE=1`, `DASH_TESTNET_RESERVE_CREDITS`, `DASH_TESTNET_MAX_RUN_CREDITS`, `DASH_TESTNET_MAX_LESSON_CREDITS`, and `DASH_TESTNET_MAX_TRANSITION_FEE_CREDITS`. `DASH_TESTNET_SIGNER_COMMAND` must be an absolute path to a separately reviewed executable. It receives one JSON object on stdin and emits one public JSON object on stdout:

- `{"action":"status","network":"testnet"}` → `{"balanceCredits":"..."}`
- `{"action":"fund",...}` → `{"status":"funded","reference":"..."}`

The signer owns the issuer key and must independently enforce the same reserve and spend policy. The runner never sends its path to learner code.

An SDK fixture started with `--live-protocol` emits one `funding-request` JSON line, waits for one `funding-result` line, performs the assigned operation with a disposable actor, then emits one public `result` line. Its `.verify.mjs` peer receives only that public result on stdin and verifies it independently with proof-enabled `@dashevo/wasm-sdk`. On macOS both processes run under a filesystem sandbox that denies the user home directory except for their worktree, Node runtime, and pinned dependencies. Other operating systems fail closed until an equivalent sandbox is implemented.
