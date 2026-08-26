# Progress sync

Learners can save their lesson progress to Dash Platform. It's optional, and signing up means
creating a passkey — no email, no password, no wallet.

`localStorage` is still the source of truth while someone is reading. Platform is the durable
copy, so clearing a cache or picking up a phone doesn't cost you 18 modules of work. None of
this is on the critical path: if the server is down, the passkey is unsupported, or the whole
thing is unconfigured, lessons work exactly as they did before and the sync button hides
itself.

## How it works

```
authentication assertion
    ├─ credential id ──HMAC(salt)──▶ learnerKey ──query──▶ progress document
    └─ signature ────────────────────────────────────────────────▶ verify with stored public key
```

The server issues a challenge, the passkey signs it, and the server verifies that signature
against the public key it stored when the passkey was registered. Ordinary WebAuthn — no
extensions, so it works on every authenticator.

`learnerKey` is a record locator, not a signing or encryption key. A WebAuthn assertion contains
the credential id and a signature, but not the credential's public key. The server HMACs the id
with `DASH_LEARNER_KEY_SALT` to derive `learnerKey`, queries the Platform document by that unique
index, then uses the document's `credentialPublicKey` to verify the signature. Both fields are
needed: one finds the record, and the other proves the assertion came from the registered
passkey.

The HMAC means scraping the contract yields 32-byte lookup values that cannot be reversed into
the credential ids that select them.

Credentials are discoverable (`residentKey: required`). There's no user table to look anyone
up in, so the browser has to find the credential on its own and tell us which one it used.

Lose the passkey and the record is gone. There's no recovery path.

The passkey dialog is available from the profile button. When a signed-out learner completes
progress, a session-scoped toast offers to open it; the header never gains a separate Save
button. After sign-in, the session cookie carries every later completion on its own — a push
needs the cookie, never the authenticator — so saving happens automatically.

Sign-in authenticates before it writes. If only this device has progress, that state is saved
to the passkey record. If only the passkey has progress, it replaces the empty local state. If
both sides contain different progress, the dialog shows both counts and asks which copy should
replace the other.

## What's stored

One `progress` document per learner, in the academy's data contract. The academy identity owns
and signs it — learners never hold Platform keys.

| Field | Size | Notes |
|---|---|---|
| `learnerKey` | 32 B | HMAC-derived unique lookup value; not a cryptographic signing key |
| `version` | int | wire format version of the bitfield |
| `completed` | 4 B | one bit per challenge |
| `credentialPublicKey` | varies | COSE WebAuthn verification key, fetched after lookup |

The bitfield is fixed width, and that's the whole cost model: a document that never changes
size pays storage once when it's created, then only processing on every update after. Bit
positions live in `lib/progress/slots.ts` and are append-only — renumber one and every stored
document decodes wrong.

Quiz answers and scores stay on the device. So do notes (`lib/notes-store.ts`).

One consequence to know up front: Platform can't see inside a byte array, so nothing about
completion is queryable. "How many learners finished module 12" has no answer here, with or
without an index.

## Costs

The deterministic-id measurements do not apply to this indexed contract. Run
`npm run platform:measure-fees` after registering it to measure the create and update costs;
the harness includes the indexed learner key and the passkey public key.

Fee constants belong to the protocol version, not the network, so these hold on mainnet only
while both run the same version — testnet usually runs ahead. Re-measure after any Platform
upgrade.

## Code map

| Path | Role |
|---|---|
| `lib/passkey.ts` | passkey ceremonies, browser only |
| `lib/progress/sync.ts` | client entry points |
| `app/actions/progress.ts` | server actions — no HTTP boundary, typed on both sides |
| `app/lib/progress-repository.ts` | reads and writes the document |
| `app/lib/session.ts` | signed session and challenge cookies, no store |
| `app/lib/webauthn.ts` | relying-party config |
| `app/lib/platform.ts` | write-capable Evo SDK client |
| `contracts/dash-academy.schema.json` | the contract |

Background saves are unioned so a stale tab can't roll someone back. Replacement is only used
after the learner chooses a side during sign-in reconciliation.

## Configuration and deployment

See [the README](../README.md#deploy). Nothing here runs without
`DASH_ACADEMY_CONTRACT_ID`, and the contract has to be registered once per network first.

WebAuthn is scoped to the URL in the browser. `npm run dev` uses the localhost values in
`.env.example`. `npm run dev:isolated` derives the RP ID, origin, and Next development-origin
allowlist from the `PORTLESS_URL` that Portless injects into the child process. This also covers
worktree prefixes and custom TLDs. The RP ID has no scheme, port, or trailing slash; the origin
includes the scheme and must otherwise match exactly. Restart Next after changing either value.
