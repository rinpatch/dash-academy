---
name: write-dash-lesson
description: Research, author, review, and verify one Dash Academy lesson against the fixed curriculum, authoritative Dash docs, pinned SDK APIs, evidence requirements, and lesson test harness. Use for any lesson-factory research, question, MDX authoring, fixture, review, or repair stage.
---

# Write Dash Lesson

Work on exactly the module supplied by the runner. First read the root `AGENTS.md`, the module row in `lesson-factory/curriculum.json`, and the `dash-docs` skill. Also read [workflow.md](references/workflow.md).

## Audience

Learners are developers who are new to Dash **and new to blockchain**. They are not new to programming.

- Write for someone who wants to build an app, not for someone auditing the protocol. Answer "what does this let me do, and how do I do it" before "how does the network achieve it".
- Cover the manifest row's `mustCover`. Treat `mustNotCover` as a hard boundary: those topics belong to a later lesson.
- `mustCover` is a checklist of ideas, never an outline. A lesson with one section per bullet, in bullet order, under headings that restate the bullets, has failed even though every box is ticked. Find the question a developer would actually ask, and let the answer pull the required ideas in wherever they belong.
- Each section must be *caused* by the one before it — a new question the previous section opened, not the next item on a list. If a section could be cut or reordered without the reader noticing, the lesson has no argument.
- A protocol mechanism belongs in a lesson only when a learner cannot complete that lesson's task or quiz without it. Otherwise name the effect, not the machinery ("payments confirm in about a second" beats an InstantSend-versus-ChainLock comparison).
- Every term of art must be explained at first use, but not necessarily in the prose. Prefer `<Term id="...">the term</Term>`, which shows a definition on click, for jargon that is incidental to this lesson — a word the reader must recognise to parse the sentence but which carries none of the lesson's learning objectives. Reuse an existing id from `lib/glossary.ts` where one fits, so the course words a term the same way everywhere. You may append a new entry to that file when your lesson needs a term it does not yet define. Never remove or reword an existing entry: other lessons depend on it, and the runner rejects a lesson that deletes one. Never use `<Term>` for a concept the manifest's `mustCover` names: that is the lesson's job, and it belongs in the prose.
- Define a term inline instead when the sentence around it depends on the meaning. The lesson must read correctly for someone who never opens a popover.
- Analogies and short worked examples over specification tables. Comparison tables are for choices the learner has to make.

Pedagogy review must return `revise` when a lesson leads with mechanism, covers a `mustNotCover` topic, or leaves a term of art both unmarked and undefined. A term wrapped in `<Term>` with a glossary entry counts as explained; do not ask for prose duplicating it.

Pedagogy review must also return `revise` when the lesson has no through-line: sections that mirror the
`mustCover` order, headings that restate the manifest, or a run of true statements with nothing making
the reader want the next one. This is a blocking defect, not a wording preference — a lesson nobody
finishes teaches nothing, and it is the one failure the other gates cannot see.

## Prose

Read [anti-ai-slop-writing](../anti-ai-slop-writing/SKILL.md) and its banned-words reference, and
write within them. It catches the tells this skill's pedagogy rules do not: punctuation rhythm,
uniform sentence length, chains of short declaratives, filler vocabulary.

### Anti-slop scope

That skill was written for tweets, emails, and blog posts. Where it disagrees with the rules below,
the rules below win.

- **Never add a specific to satisfy it.** It asks for numbers, named things, moments in time, and
  friction. A lesson's claims must all trace to `evidence.json`, so the only specifics available are
  the ones research already established. Where it wants concrete detail you do not have, cut the
  vague sentence rather than invent a replacement — facts review will catch a fabricated one, and a
  revision round is expensive.
- **Its formatting rules are for social media.** Lessons need `##` headings, `## What you
  accomplished`, and the MDX components. Ignore "no markdown headers" and "no bold" entirely.
- **Banned words are banned as filler, not as terminology.** A lesson about keys says "key", and an
  SDK lesson about robustness of a query says what it means. The list targets words reached for to
  sound impressive; it never overrides the correct technical term.
- Fragments and deliberately ugly sentences are a smaller licence here than it implies. A learner
  parsing an unfamiliar concept needs the sentence to hold together on the first read.

Em dashes are the measured failure: the first three concept lessons shipped 19 to 22 apiece against
that skill's budget of one per 500 words. At lesson length that is three or four, so it is a real
constraint, not a rounding note. Use commas, semicolons, colons, parentheses, or a new sentence.

Pedagogy review must return `revise` for anti-slop violations only where they make the lesson worse
to read — em dash density well over budget, a run of same-length sentences, banned filler doing real
work in a sentence. A single stray banned word is a finding, not a verdict.

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
