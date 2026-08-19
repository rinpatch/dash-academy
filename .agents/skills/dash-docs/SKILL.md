---
name: dash-docs
description: Authoritative reference for Dash Core and Dash Platform when writing or debugging Dash code. Triggers on Dash Core RPCs / dashcore, InstantSend/ChainLocks, masternodes, DIPs; and Dash Platform — the JS/Rust SDK (@dashevo/wasm-sdk, dash), DPNS names, identities, data contracts & documents, DAPI/gRPC, protocol reference. Consult these docs instead of relying on model memory — the SDK moves fast.
---

# Dash docs

Vendored upstream docs as git submodules, pinned:

- `docs/` — Dash **Core** (`github.com/dashpay/docs` @ 23.0.0)
- `docs-platform/` — Dash **Platform** (`github.com/dashpay/docs-platform` @ 3.1.0)
- `platform-book/book/` — **The Dash Platform Book** (`github.com/dashpay/platform` @ `v4.2-dev`, sparse-checked out to `book/` only): design philosophy, patterns, and conventions of the Rust codebase — architecture, data model, SDKs, state transitions, fees, serialization, versioning

These are the source `.md` files, not built HTML. Grep/Read them directly; don't dump whole trees into context.

## Where to look

**Core** — `docs/docs/core/`
- `guide/` — concepts: block chain, transactions, wallets, mining, P2P, InstantSend, ChainLocks, masternodes
- `api/` — `dash-cli` / JSON-RPC command reference
- `reference/` — data formats, opcodes, protocol constants
- `examples/` — worked RPC examples
- `dashcore/` — running/configuring dashd
- `dips/` — Dash Improvement Proposals

**Platform** — `docs-platform/docs/`
- `intro/` — what Platform is, key concepts
- `tutorials/` — SDK usage: identities-and-names, contracts-and-documents, node-setup, example-apps
- `explanations/` — identities, DPNS, data contracts, documents, drive, tokens
- `reference/` — query syntax, fees, limits
- `protocol-ref/` — state transitions, wire format
- `sdk-rs/` — Rust SDK reference
- `ai-prompt.md` — upstream's own condensed LLM primer; skim it first for Platform tasks

**Platform Book** — `platform-book/book/src/`
- `architecture/`, `data-model/`, `drive/`, `serialization/`, `versioning/`, `error-handling/`, `fees/`, `addresses/`, `state-transitions/`, `testing/` — codebase-level design docs
- `sdk/`, `evo-sdk/`, `wasm/` — SDK internals and conventions (complements `docs-platform/sdk-rs/`, which is API reference; the book explains *why*)
- `SUMMARY.md` — table of contents

## How to use

1. Start from the relevant `index.md` (`docs/docs/core/index.md`, `docs-platform/docs/index.md`), `docs-platform/docs/ai-prompt.md`, or `platform-book/book/src/SUMMARY.md`.
2. Grep for the symbol/RPC/term across the matching tree.
3. Read only the file(s) that hit.

## Updating

```bash
git submodule update --remote .agents/skills/dash-docs/docs             # follows 23.0.0
git submodule update --remote .agents/skills/dash-docs/docs-platform    # follows 3.1.0
git submodule update --remote .agents/skills/dash-docs/platform-book    # follows v4.2-dev
```
Then commit the bumped submodule pointer.

`platform-book` is sparse-checked out to `book/` only (cone mode also keeps top-level repo files like `Cargo.toml`, `package.json` — harmless, ~12M total vs. the full monorepo). After any `submodule update`, sparse-checkout stays put — no need to re-set it.

<!-- shallow submodules; docs/binary (141M PDFs) + docs/locale (62M translations) are pulled but useless here. If disk matters, sparse-checkout to exclude them:
  git -C docs sparse-checkout set --no-cone '/*' '!/binary' '!/locale'
Not reproducible across fresh clones without scripting — add only if it bites. -->
