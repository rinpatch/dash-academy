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
passkey ──PRF──▶ 32-byte secret ──sha256──▶ clientKey ──HMAC(salt)──▶ learnerKey
   (browser, never leaves)                    (sent)                  (on-chain index)
```

A passkey can do more than sign challenges. The WebAuthn PRF extension asks it for
`HMAC(secret_inside_the_authenticator, some_input)`, and the answer is always the same for the
same input — on every device the passkey syncs to, and nowhere else. That gives us a stable
account handle without storing anything about the user.

The server never sees the PRF output itself, only a hash of it, and it HMACs that with
`DASH_LEARNER_KEY_SALT` before using it as the on-chain identifier. So scraping the contract
gets you a pile of 32-byte keys that can't be reversed into anything that opens a record.

Credentials are discoverable (`residentKey: required`). There's no user table to look anyone
up in, so the browser has to find the credential on its own.

**The derived key is a bearer token.** Nothing is verified server-side — only the real passkey
can produce that key, so holding it *is* the proof. Whoever has it can read and write that
learner's progress. That's a fair trade for a record of course completion, but don't reuse the
pattern for anything that matters more.

Lose the passkey and the record is gone. There's no recovery path.

## What's stored

One `progress` document per learner, in the academy's data contract. The academy identity owns
and signs it — learners never hold Platform keys.

| Field | Size | Notes |
|---|---|---|
| `learnerKey` | 32 B | unique index, and the only way to find a record |
| `version` | int | wire format version of the bitfield |
| `completed` | 4 B | one bit per challenge |

The bitfield is fixed width, and that's the whole cost model: a document that never changes
size pays storage once when it's created, then only processing on every update after. Bit
positions live in `lib/progress/slots.ts` and are append-only — renumber one and every stored
document decodes wrong.

Quiz answers and scores stay on the device. So do notes (`lib/notes-store.ts`).

One consequence to know up front: Platform can't see inside a byte array, so nothing about
completion is queryable. "How many learners finished module 12" has no answer here, with or
without an index.

## Costs

Measured on testnet at protocol version 13, not estimated — run `npm run platform:measure-fees`
to re-check:

| | Credits | DASH |
|---|---|---|
| Create a record | 23,944,700 | 0.00023945 |
| Update one | 2,777,300 | 0.00002777 |
| A learner over a full course (1 create + ~25 updates) | 93,377,200 | 0.00093377 |

That's roughly **9.3 DASH per 10,000 learners**. Registering the contract is a separate
one-off: 0.171 DASH, most of it the flat 0.1 base fee.

Fee constants belong to the protocol version, not the network, so these hold on mainnet only
while both run the same version — testnet usually runs ahead. Re-measure after any Platform
upgrade.

## Code map

| Path | Role |
|---|---|
| `lib/passkey.ts` | PRF key derivation, browser only |
| `lib/progress/sync.ts` | client entry points |
| `app/actions/progress.ts` | server actions — no HTTP boundary, typed on both sides |
| `app/lib/progress-repository.ts` | reads and writes the document |
| `app/lib/session.ts` | signed cookies, no session store |
| `app/lib/platform.ts` | write-capable Evo SDK client |
| `contracts/dash-academy.schema.json` | the contract |

Progress is unioned rather than overwritten, so a stale tab can't roll someone back.

## Configuration and deployment

See [the README](../README.md#deploy). Nothing here runs without
`DASH_ACADEMY_CONTRACT_ID`, and the contract has to be registered once per network first.
