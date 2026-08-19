# Writing lessons

Lessons live in `content/academy/`, one `.mdx` file per lesson. MDX is Markdown plus a few
components — write normal Markdown and drop a component in where you need one.

## Preview what you write

```sh
npm install       # once
npm run dev       # then open http://localhost:3000/learn/<lesson-slug>
```

The page reloads as you save. When you are done:

```sh
npm run lessons -- validate
```

That checks every lesson against the curriculum and prints exactly what is wrong. Run it before
handing work over — it catches the mistakes that are easy to make and annoying to spot.

## The curriculum is fixed

The 17 lessons are defined in `curriculum/lessons.json`. That file is the source of truth for each
lesson's title, description, length, and what it must cover. **You edit the lesson text; a developer
edits the curriculum.** If a lesson needs a different title or a different scope, ask — don't change
the frontmatter to disagree with the manifest, because validation will reject it.

## Anatomy of a lesson

Every file starts with frontmatter between `---` lines. Copy these values from the lesson's row in
`curriculum/lessons.json`; they must match exactly.

```mdx
---
title: What is Dash Platform?
description: Meet Dash, and see what Dash Platform lets you build.
module: 1
tier: concepts
estimatedMinutes: 12
exp: 100
verification: quiz
prerequisites: []
---
```

| Field | What it is |
|---|---|
| `title`, `description` | Must match the manifest word for word |
| `module` | Position in the course, 1–17 |
| `tier` | `concepts` (reading + quiz) or `sdk` (hands-on testnet work) |
| `estimatedMinutes`, `exp` | From the manifest |
| `verification` | `quiz`, `testnet`, or `hybrid` |
| `prerequisites` | **Module numbers, not slugs** — `[3]`, not `["identities"]` |

Then the body. Three headings are required and validation fails without them:

- `## Learning objectives` — near the top, phrased as things the reader will be able to *do*
- `## Checkpoint` — where the quiz or verifier goes
- `## What you accomplished` — a short close

Don't use a top-level `# Heading` in the body; the title comes from the frontmatter.

## Who you are writing for

Developers who are **new to blockchain but not new to programming**. They want to build something.

- Answer "what does this let me do" before "how does the network do it".
- Lead with the effect, not the mechanism. "Payments confirm in about a second" beats an explanation
  of the locking protocol.
- Explain every term of art the first time — but see `<Term>` below, which usually does it better
  than a sentence of definition.

## Components

All five are available in any lesson without importing anything.

### `<Term>` — a clickable definition

Marks a piece of jargon. The reader clicks and gets a short definition in a popover; readers who
already know the word just keep reading.

```mdx
Dash Platform has no <Term id="smart-contract">smart contracts</Term> to deploy.
```

Available ids, defined in `lib/glossary.ts`:

`smart-contract` · `ico` · `premine` · `grpc` · `json-rpc` · `fiat` · `masternode` · `dapp` ·
`testnet` · `identity` · `state-transition`

To add a new one, append an entry to `lib/glossary.ts` — copy the shape of an existing one. Never
edit or delete an entry someone else's lesson may be using.

Use it for jargon that is *incidental* — a word the reader must recognise to parse the sentence but
that isn't what the lesson is teaching. **Don't** use it for the lesson's actual subject: if the
lesson is about identities, teach identities in the prose. And the sentence must still make sense
if nobody ever clicks.

### `<Callout>` — an aside

```mdx
<Callout type="info" title="A useful mental model">
Dash Core is the money layer. Dash Platform is the data layer.
</Callout>
```

`type` is one of `info`, `idea`, `warn`, `warning`, `error`, `success`. Use `warn` for anything about
losing money or keys.

### `<LessonQuiz>` — the checkpoint for a concepts lesson

```mdx
<LessonQuiz
  challengeId="what-is-dash-platform"
  passingScore={4}
  questions={[
    {
      id: "two-layers",
      prompt: "An app needs to store user profiles. Which layer handles that?",
      options: [
        { id: "a", label: "Dash Core, the payments chain." },
        { id: "b", label: "Dash Platform, the application data layer." },
      ],
      correctOptionId: "b",
      explanation: "Core moves money; Platform stores structured application data.",
    },
  ]}
/>
```

`challengeId` must be the lesson's slug — a developer has to register any new id before it works.
Every question needs an `explanation`; it's shown after answering and is where most of the teaching
happens, so write it properly rather than restating the correct option.

Write questions that test whether someone could *act*. "Which layer would you use for X" is a good
question; "what does DAPI stand for" is not.

### `<TestnetVerifier>` — the checkpoint for a hands-on lesson

The reader pastes the public result of their work and Dash Academy looks it up on testnet.

```mdx
<TestnetVerifier
  challengeId="register-a-username"
  operation="dpns-register"
  label="Identity that owns the name"
/>
```

`challengeId` and `operation` both come from the lesson's row in `curriculum/lessons.json` — copy
them, don't invent them. `label` and `placeholder` are optional and just change the wording around
the input.

Verification is implemented per operation on the server. Today that's `identity-create` and
`dpns-register`; anything else answers "not verifiable yet" rather than passing the reader. If your
lesson needs an operation that isn't implemented, a developer has to add the check first.

`<IdentityVerifier challengeId="create-a-dash-identity" />` is the older, identity-only version still
used by that one lesson. Use `TestnetVerifier` for anything new.

`<WalletSetup>` exists but no lesson uses it yet, so treat it as unproven.

## Which lessons appear, and in what order

`content/academy/meta.json` lists the lessons shown in the sidebar, in order:

```json
{
  "title": "Dash Academy",
  "pages": ["what-is-dash-platform", "create-a-dash-identity"]
}
```

A lesson file that isn't listed here still builds, but nobody can find it. Add the slug (the filename
without `.mdx`) when a lesson is ready to be seen.