# Dash Academy

Dash Academy is a Next.js course application backed by a fixed 17-module curriculum. Lesson content is MDX under `content/academy/`; each lesson's committed technical evidence is under `lesson-sources/`.

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
npm run lessons:test
npm run lessons -- validate --all
```

## Operate the lesson factory

Read [`AGENTS.md`](AGENTS.md) first. The complete setup, research/author/review workflow, status and recovery commands, isolated browser setup, artifacts, trusted testnet boundary, and integration procedure are documented in the [`lesson factory operator runbook`](scripts/lesson-factory/README.md).

The shortest safe entry point for a new coding session is:

```sh
npm run lessons -- preflight
npm run lessons -- status
npm run lessons -- questions
```

Do not place mnemonics, private keys, or secret-bearing local environment files in this checkout while lesson agents or browser servers are running. A Tier 2 `local-passed` result is not a live testnet pass.
