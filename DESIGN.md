# Dash Academy Design System

Dash Academy is a custom card-based lesson dashboard, not a generic docs site. Every screen is built from a small set of rounded white cards floating on a soft background, with a persistent header, a sticky course-progress sidebar, and a lesson notebook — matching the product's promise of visible, legible progress.

## Foundations

- **Typography:** Manrope is the interface and prose font. Geist Mono is reserved for code and identifiers. Headings and emphasis use `font-extrabold`; body and secondary text use `font-medium`. Lesson prose (headings, paragraphs, lists, code blocks, tables) is styled by Fumadocs' typography preset via `DocsBody`/`prose` — do not hand-roll prose typography. `DocsBody` justifies the lesson body with automatic hyphenation (ragged-right below `sm`, where the measure is too short to justify cleanly); this inherits, so any interactive lesson component must keep marking itself `not-prose`, which resets it back to ragged-right.
- **Color:** Hyperwave Blue (`--primary`, `#4C7EFF`) marks primary actions, current navigation, and progress. Midnight Circuit (`--foreground`, `#0C1C33`) anchors text. Mint Current (`--mint`) communicates successful verification. Warning orange (`--warning`) marks safety callouts. Never introduce new hardcoded colors — express hierarchy with opacity on the existing tokens instead (see below).
- **Opacity scale for text/borders:** built directly on `--foreground` so light and dark mode stay correct automatically.
  - `text-foreground` — headings, high-emphasis values
  - `text-foreground/64` — body copy, descriptions
  - `text-foreground/48` — secondary labels, metadata
  - `text-foreground/35` — inactive tabs/controls
  - `border-foreground/12` — hairlines, dividers, card borders
  - `border-foreground/24` — input and button outlines
- **Cards:** the base unit of the UI. Outer cards are `rounded-3xl bg-card p-4`; nested cards/wells are `rounded-2xl`; pills, tags, and small buttons are `rounded-xl` or `rounded-full`. Use the shared `Card` primitive (`components/ui/card.tsx`) instead of re-declaring the card classes. Cards sit on `bg-background`, a soft off-white (or dark surface in dark mode) — never pure white behind a white card.
- **Layout:** lesson pages are a 3-column grid at desktop (`224px` progress/nav sidebar · flexible content · `288px` notes sidebar) that collapses to a single stacked column on mobile, content first, sidebars above/below it. Max content width is `1360px`, centered — shared with the header (`components/site/header.tsx`), so the two must change together or the header falls out of alignment with the grid. The sidebars are fixed pixels and only the middle column flexes, so every pixel the viewport lacks comes out of the reading column: budget `viewport − 656` for it on desktop, and keep the sidebars narrow enough that mid-size laptops (~1280–1400) still clear ~640px. Lesson prose stays at the preset's 16px, which puts the measure near 80 characters across that range.

## Lesson Page Anatomy

- **Header** (`components/site/header.tsx`): real Figma-exported logo (`components/site/dash-academy-logo.tsx`, inlined SVG with `fill-primary`/`fill-foreground` so it themes correctly), primary nav, search (wired to Fumadocs search), theme toggle, and a static learner pill. Sticky, white, rounded bottom corners.
- **Course track card** (`components/lesson/course-track-card.tsx`): real completion percentage computed from the progress store, not decorative.
- **Lesson nav list** (`components/lesson/lesson-nav-list.tsx`): one card per lesson in module order, with a completed/current/upcoming status icon. The current lesson's card expands into an "On this page" outline driven by the real table of contents and scroll position (`fumadocs-core/toc`'s `AnchorProvider`/`useActiveAnchor`, the same primitive Fumadocs' own TOC uses). The whole sidebar is `sticky` on desktop (`lg:sticky lg:top-28`, scrolling internally if it's taller than the viewport) so the outline highlight stays visible while reading.
- **Tabs** (`components/lesson/lesson-tabs.tsx`): Overview renders the lesson's MDX body. Resources/Discussion are placeholders until those content models exist — do not fill them with fabricated content.
- **Notes** (`components/lesson/notes-panel.tsx`, `lib/notes-store.ts`): a lightweight, per-lesson, local-only notebook (same zustand+localStorage pattern as progress). It is not shared, synced, or exported anywhere. Like the progress sidebar, it is `sticky` on desktop (`lg:sticky lg:top-28`, scrolling internally past the viewport height) so the composer stays reachable while reading.
- **Callouts** (`components/lesson/callout.tsx`): left-accent card, color keyed to type (`info`/`idea` → primary, `warn`/`warning` → warning, `error` → destructive, `success` → mint).
- **Glossary terms** (`components/lesson/term.tsx`, `lib/glossary.ts`): an inline term the reader can click for a short definition, built on the Fumadocs/Radix popover so it is keyboard and screen-reader operable. An unknown id renders as plain text rather than hiding the sentence.

## Lesson Content

Lessons use ordinary MDX headings, paragraphs, lists, links, code blocks, and callouts. Keep explanations concise and place content in a single linear reading flow inside the Overview tab.

### Terms of art

Learners are new to blockchain but not new to programming, so a lesson has to define jargon without boring the readers who already know it. Mark the term instead of explaining it in the prose:

```mdx
Dash Platform has no <Term id="smart-contract">smart contracts</Term> to deploy.
```

- Add the definition to `lib/glossary.ts` once; every lesson reuses it, and the wording stays consistent across the course.
- Use `<Term>` for jargon that is *incidental* to the lesson — a word the reader must recognise to parse the sentence, but which carries none of the lesson's learning objectives. `ICO`, `gRPC`, and `premine` are the shape of thing that belongs here.
- Do **not** use it for the lesson's actual subject. If a `mustCover` item names the concept, teach it in the prose; a popover is not a substitute for a lesson.
- Mark a term on its first meaningful use, not every occurrence. Repeated highlights read as noise.
- The sentence must still make sense if the popover is never opened. Definitions are a courtesy to the reader, never load-bearing.

Academy-authored interactive lesson components are limited to focused verification checkpoints: concept quizzes and testnet verification, restyled to the card system above but functionally unchanged. Quizzes present one question at a time with explicit answer feedback and a final pass/fail state. Testnet verification may contain the form and the loading, error, success, and restored states needed to verify public network activity.

## Constraints

- Reuse the `Card` primitive and the opacity scale above; don't invent new surface colors, radii, or one-off muted-text values.
- Don't build out Resources, Discussion, or multi-track curriculum data models speculatively — the UI accommodates them, but ship placeholders until the content actually exists.
- Keep verification and quizzes keyboard accessible, announce status changes in text, preserve learner input on failure, and never request a mnemonic or private key.
- Use color for meaning, not decoration. Verification states must remain understandable without color.
- The notes feature is local-only by design; don't add sync/export without a stated product need.
