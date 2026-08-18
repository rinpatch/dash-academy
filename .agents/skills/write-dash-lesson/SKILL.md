---
name: write-dash-lesson
description: Research, author, review, and verify one Dash Academy lesson against the fixed curriculum, authoritative Dash docs, pinned SDK APIs, evidence requirements, and lesson test harness. Use for any lesson-factory research, question, MDX authoring, fixture, review, or repair stage.
---

# Write Dash Lesson

Work on exactly the module supplied by the runner. First read the root `AGENTS.md`, the module row in `curriculum/lessons.json`, and the `dash-docs` skill. Also read [workflow.md](references/workflow.md).

## Required sequence

1. Research the lesson independently. Prefer vendored Dash docs for concepts and installed package types/runtime for SDK shape.
2. Record claims, sources, API examples, version conflicts, and uncertainty in the structured stage output.
3. If a material uncertainty could change correctness, scope, safety, or pedagogy, return blocking questions. Do not guess and do not edit lesson files.
4. After questions are answered, author only the assigned lesson MDX, evidence ledger, and lesson-scoped fixture.
5. Review the result against the manifest, answers, evidence, and test output. Repair only the assigned files.

Do not alter curriculum numbering or scope. Do not access secrets or run live testnet writes. A successful local stage is not proof that the live testnet stage passed.
