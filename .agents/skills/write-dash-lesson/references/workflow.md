# Lesson workflow

The runner creates a dedicated branch and worktree per lesson. Its durable state is under `lesson-factory/.runs/`; generated reports are never committed.

Research output must distinguish directly supported claims from inference and include exact locators. Package types/runtime are authoritative for the pinned SDK API. When sources conflict, describe the conflict and either resolve it with a stronger source or block.

Authoring output must preserve frontmatter from the manifest. Tier 1 uses one quiz whose challenge ID is the lesson slug. Tier 2 testnet lessons use a final verifier whose challenge ID is the lesson slug. Hybrid lessons use a non-completing `<slug>:quiz` checkpoint plus the final verifier.

Every executable example must map to a fixture assertion. Tests must be deterministic before a trusted live test is attempted. Do not use placeholder identity IDs, fabricated transactions, or claims that a network operation succeeded when it was skipped.
