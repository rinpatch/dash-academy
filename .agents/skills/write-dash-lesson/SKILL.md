---
name: write-dash-lesson
description: Research, author, review, and verify one Dash Academy lesson against the fixed curriculum, authoritative Dash docs, pinned SDK APIs, evidence requirements, and lesson test harness. Use for any lesson-factory research, question, MDX authoring, fixture, review, or repair stage.
---

# Write Dash Lesson

Work on exactly the module supplied by the runner. First read the root `AGENTS.md`, the module row in `curriculum/lessons.json`, and the `dash-docs` skill. Also read [workflow.md](references/workflow.md).

## Audience

Learners are developers who are new to Dash **and new to blockchain**. They are not new to programming.

- Write for someone who wants to build an app, not for someone auditing the protocol. Answer "what does this let me do, and how do I do it" before "how does the network achieve it".
- Cover the manifest row's `mustCover`. Treat `mustNotCover` as a hard boundary: those topics belong to a later lesson.
- A protocol mechanism belongs in a lesson only when a learner cannot complete that lesson's task or quiz without it. Otherwise name the effect, not the machinery ("payments confirm in about a second" beats an InstantSend-versus-ChainLock comparison).
- Every term of art must be explained at first use, but not necessarily in the prose. Prefer `<Term id="...">the term</Term>`, which shows a definition on click, for jargon that is incidental to this lesson — a word the reader must recognise to parse the sentence but which carries none of the lesson's learning objectives. Reuse an existing id from `lib/glossary.ts` where one fits, so the course words a term the same way everywhere. You may append a new entry to that file when your lesson needs a term it does not yet define. Never remove or reword an existing entry: other lessons depend on it, and the runner rejects a lesson that deletes one. Never use `<Term>` for a concept the manifest's `mustCover` names: that is the lesson's job, and it belongs in the prose.
- Define a term inline instead when the sentence around it depends on the meaning. The lesson must read correctly for someone who never opens a popover.
- Learning objectives are things the learner can *do*, not things they can recite. Prefer "choose when to use X" over "explain how X works".
- Analogies and short worked examples over specification tables. Comparison tables are for choices the learner has to make.

Pedagogy review must return `revise` when a lesson leads with mechanism, covers a `mustNotCover` topic, or leaves a term of art both unmarked and undefined. A term wrapped in `<Term>` with a glossary entry counts as explained; do not ask for prose duplicating it.

## Required sequence

1. Research the lesson independently. Prefer vendored Dash docs for concepts and installed package types/runtime for SDK shape.
2. Record claims, sources, API examples, version conflicts, and uncertainty in the structured stage output.
3. If a material uncertainty could change correctness, scope, safety, or pedagogy, return blocking questions. Do not guess and do not edit lesson files.
4. After questions are answered, author only the assigned lesson MDX, evidence ledger, and lesson-scoped fixture.
5. Review the result against the manifest, answers, evidence, and test output. Repair only the assigned files.

Do not alter curriculum numbering or scope. Do not access secrets or run live testnet writes. A successful local stage is not proof that the live testnet stage passed.

## Hands-on checkpoints

A tier 2 lesson's `## Checkpoint` must contain a registered verification component wired to the
manifest's `challengeId`; validation rejects the id appearing only in prose. Use
`<TestnetVerifier challengeId="..." operation="..." />`, copying both values from the manifest row.
`<TestnetVerifier>` is the only verification component available.

You cannot add or edit components. Server-side verification exists today for `identity-create` and
`dpns-register` only; every other operation answers "not verifiable yet". If your lesson's operation
has no check, say so in your stage output and let the runner block rather than shipping a checkpoint
that cannot pass.
