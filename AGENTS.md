# Dash Academy agent rules

Read `.agents/skills/dash-docs/SKILL.md` before researching or changing Dash technical content. Read `.agents/skills/write-dash-lesson/SKILL.md` before running a lesson stage.

The fixed curriculum is `lesson-factory/curriculum.json`. Do not renumber, split, merge, or silently broaden lessons. If the requested scope is technically unsound, write a blocking question to the run report instead.

Treat Git MDX and committed evidence ledgers as the source of truth. Notion is reference input only. Never write to Notion.

Generate lessons sequentially in the current checkout, not parallel worktrees. Read earlier lessons
when planning, drafting, and reviewing; keep edits scoped to the assigned lesson. Finish its review
before starting the next, and stop the sequence on a blocked or failed lesson.

Never read, print, copy, or pass `.env.local`, `*.local.json`, mnemonics, private keys, issuance secrets, or unrelated credentials to a model or browser. Lesson agents may write only their assigned MDX, evidence ledger, and lesson-scoped fixture. Live testnet execution is a separate trusted phase.

Do not run more than one testnet writer at a time. Never commit generated run state, browser profiles, screenshots, or worktrees.

## Lesson file contract

Follow the manifest row for the assigned module exactly. Teach the required concepts and include the quiz or verifier matching the manifest. Do not add learning-objective lists, "What you accomplished" recaps, or "Checkpoint" headings. Start on the subject; the quiz and verifier components provide their own labels.

Use stable challenge IDs from the manifest. Hybrid quiz IDs end in `:quiz`; they are checkpoints and do not complete the lesson. Executable examples must have a lesson-scoped fixture and evidence-ledger entry. Never invent an SDK method: verify package types/runtime for the pinned 4.1.1 SDK and cite authoritative Dash sources.
