# Dash Academy Design System

Dash Academy uses Fumadocs as its interface and reading system. The product should feel like clear technical documentation with a focused hands-on checkpoint, not a custom course dashboard.

## Foundations

- **Typography:** Manrope is the interface and prose font. Geist Mono is reserved for code and identifiers. Fumadocs owns font sizes, weights, line heights, content width, and responsive typography.
- **Color:** Hyperwave Blue (`#4C7EFF`) marks primary actions and current navigation. Midnight Circuit (`#0C1C33`) anchors text and dark surfaces. Mint Current (`#60F6D2`) communicates successful verification. Existing accessible light and dark ramps remain defined in `app/globals.css`.
- **Layout:** Use the standard Fumadocs docs layout, sidebar, table of contents, breadcrumbs, footer, prose spacing, and code blocks. Do not add custom page-width or heading-size overrides.

## Lesson Content

Lessons use ordinary MDX headings, paragraphs, lists, links, code blocks, and occasional Fumadocs callouts. Keep explanations concise and place content in a single linear reading flow.

Academy-authored interactive lesson components are limited to focused verification checkpoints: concept quizzes and testnet verification. Quizzes present one question at a time with explicit answer feedback and a final pass/fail state. Testnet verification may contain the form and the loading, error, success, and restored states needed to verify public network activity.

## Constraints

- Do not add custom heroes, glossary tooltips, collapsible prerequisites, sticky diagrams, scroll-driven scenes, progress cards, or locked curriculum treatments.
- Do not replace standard Fumadocs navigation or content components unless a concrete usability requirement cannot be met by the defaults.
- Keep verification keyboard accessible, announce status changes in text, preserve learner input on failure, and never request a mnemonic or private key.
- Use color for meaning, not decoration. Verification states must remain understandable without color.
