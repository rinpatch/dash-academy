# Lesson workflow

The runner works in module order in the current checkout. It finishes research, authoring, tests,
both reviews, and a commit before starting the next lesson. It stops on a failure or blocking
question. No parallel lesson workers or worktrees. Its durable state is under
`lesson-factory/.runs/`; generated reports are never committed.

Earlier MDX is supplied as context to every stage. Read the direct prerequisite and relevant
earlier explanations; do not assume a lab was completed just because the manifest lists it.
Name missing or placeholder prerequisites in the teaching plan. Correct a misconception locally
when it fits the assigned scope; otherwise raise a blocking question. Never silently rewrite a
previous lesson or treat its prose as an authoritative Dash source.

## Before drafting

Research must include a `teachingPlan` with:

- `priorKnowledge`: concepts the reader can use, with earlier file/section references.
- `centralQuestion`: the developer's question that gives the lesson a reason to exist.
- `likelyMistake`: a plausible wrong decision the explanation should prevent.
- `workedExample`: one scenario that requires the ideas being taught. Label invented people and
  illustrative costs as hypothetical; source all protocol behavior.
- `reasoningChain`: how each explanation creates the need for the next.
- `continuityGaps`: missing explanations, placeholders, or false claims of earlier accomplishments.

Copy the plan into the committed evidence ledger along with a `coverageMap`. Use the human
rewrites as teaching examples, not templates for headings or unverified technical claims.

## Review as a newcomer

The pedagogy reviewer returns `readerReview`, not just a quality verdict:

- `reasoningChain`: reconstruct the explanation using only what the learner has been taught.
- `transferQuestion`, `answer`, `supportingPassages`: pose a new scenario, answer it from the text,
  and identify the passages that make the answer possible. Do not repeat a quiz question.
- `coverageGaps`: check every `mustCover` against the actual explanation, example, and assessment.
- `continuityGaps`: compare claims about prior knowledge/work against preceding MDX.

These gap arrays describe unresolved gaps that affect this draft. Put unrelated upstream repairs
in ordinary findings; don't block a self-contained explanation on a lab it never assumes.

A missing reasoning step or a necessary answer supplied from the reviewer's own Dash knowledge
requires revision. Do not reward length, decorative tables, or extra protocol details. A table
belongs only where the reader needs to compare; diagrams are optional, never a quota.

Research output must distinguish directly supported claims from inference and include exact locators. Package types/runtime are authoritative for the pinned SDK API. When sources conflict, describe the conflict and either resolve it with a stronger source or block.

Authoring output must preserve frontmatter from the manifest. Tier 1 uses one quiz whose challenge ID is the lesson slug. Tier 2 testnet lessons use a final verifier whose challenge ID is the lesson slug. Hybrid lessons use a non-completing `<slug>:quiz` checkpoint plus the final verifier.

Every executable example must map to a fixture assertion. Tests must be deterministic before a trusted live test is attempted. Do not use placeholder identity IDs, fabricated transactions, or claims that a network operation succeeded when it was skipped.
