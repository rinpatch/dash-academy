# Dash Academy

Dash Academy is a Next.js course application backed by a fixed 18-module curriculum. Lesson content is MDX under `content/academy/`; each lesson's committed technical evidence is under `lesson-sources/`.

## Develop the application

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

Repository checks:

```sh
npm run lint
npm run build
npm test
npm run lessons -- validate --all
```

## Run E2E tests

Install Playwright's Chromium build once, then run the E2E suite:

```sh
npm run test:e2e:install
npm run test:e2e
```

Playwright starts and stops Next.js at `http://localhost:3000`. Set `PORT` to use a different
port.

## Deploy

Lessons work with no configuration at all. Progress sync is opt-in and stays hidden until
these are set — see [`docs/progress-sync.md`](docs/progress-sync.md) for what it does.

| Variable | Notes |
|---|---|
| `DASH_NETWORK` | `testnet` (default) or `mainnet`. Lesson labs always verify against testnet. |
| `DASH_ACADEMY_IDENTITY_ID` | owns the contract, signs every write |
| `DASH_ACADEMY_PRIVATE_KEY_WIF` | |
| `DASH_ACADEMY_CONTRACT_ID` | from `npm run platform:register-contract` |
| `DASH_LEARNER_KEY_SALT` | ≥16 chars. Change it and every record is orphaned. |
| `DASH_SESSION_SECRET` | ≥16 chars. Change it and everyone is signed out. |

Copy `.env.example` to `.env.local`, then run these once per network, filling in what each
one prints as you go:

```sh
npm run platform:create-identity     # prints the identity id and signing key
npm run platform:register-contract   # prints the contract id
npm run platform:measure-fees        # replaces estimated costs with real ones
```

`create-identity` generates a key, prints a platform address, and waits while you fund it
through the [bridge](https://bridge.thepasta.org/) — testnet coins come from the
[faucet](https://faucet.testnet.networks.dash.org/). If it times out, re-run it with
`--wif <key>` so the funds you already sent aren't stranded — it prints the exact command,
including the `--` separator npm needs to pass flags through.

It prints **two** keys. The signing key goes in `.env.local`. The master key does not: it is
the only thing that can change the identity's keys, so keep it somewhere the app can't reach.
It is shown once and cannot be recovered — losing it means losing the ability to rotate a
leaked signing key.

`register-contract` refuses to run if `DASH_ACADEMY_CONTRACT_ID` is already set. Registering
twice creates a second, unrelated contract and orphans every record written against the first.

## Operate the lesson factory

Read [`AGENTS.md`](AGENTS.md) first. The complete setup, research/author/review workflow, status and recovery commands, isolated browser setup, artifacts, trusted testnet boundary, and integration procedure are documented in the [`lesson factory operator runbook`](scripts/lesson-factory/README.md).

The shortest safe entry point for a new coding session is:

```sh
npm run lessons -- preflight
npm run lessons -- status
npm run lessons -- questions
```

Do not place mnemonics, private keys, or secret-bearing local environment files in this checkout while lesson agents or browser servers are running. A Tier 2 `local-passed` result is not a live testnet pass.
