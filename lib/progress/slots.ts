import type { ChallengeId } from "@/lib/progress";
import { challengeSpecs } from "@/lib/progress";

/**
 * Wire format version of the progress document. Bumping means re-encoding every stored
 * document, so try the append-only path below first.
 */
export const PROGRESS_DOCUMENT_VERSION = 1;

/** Bytes in the completion bitfield. 23 slots today; 4 bytes holds 32. */
export const PROGRESS_BITFIELD_BYTES = 4;

/**
 * Bit position of each challenge in the on-chain completion bitfield.
 *
 * APPEND ONLY. Every stored document is decoded against these numbers, so changing one
 * rewrites history for anyone who has that bit set.
 *
 * - Adding: take the next unused number. Old documents read it as 0, i.e. not completed.
 * - Renaming: change the key, keep the number.
 * - Retiring: delete it here and from `challengeSpecs`, put the number in `retiredSlots`.
 * - Never reorder, renumber, or reuse.
 *
 * Not derived from `challengeSpecs` key order — that's a formatting detail, and a reformat
 * shuffling it would corrupt every record without anything failing.
 */
export const challengeSlots = {
  "what-is-dash": 0,
  "what-is-dash-platform": 1,
  "why-build-on-dash": 2,
  "dapi-and-proofs": 3,
  identities: 4,
  "wallets-keys-and-testnet": 5,
  "data-contracts": 6,
  documents: 7,
  "environment-setup": 8,
  "fund-a-platform-address": 9,
  "create-a-dash-identity": 10,
  "register-a-username": 11,
  "write-your-first-data-contract:quiz": 12,
  "write-your-first-data-contract": 13,
  "submit-a-document": 14,
  "query-documents:quiz": 15,
  "query-documents": 16,
  "document-transfer-and-purchase:quiz": 17,
  "document-transfer-and-purchase": 18,
  "tokens:quiz": 19,
  tokens: 20,
  "token-paid-document-creation:quiz": 21,
  "token-paid-document-creation": 22,
} as const satisfies Record<ChallengeId, number>;

/** Numbers from retired challenges, kept so they're never handed out again. */
export const retiredSlots: Record<number, string> = {
  // 7: "some-retired-challenge", // retired 2026-08-20
};

/**
 * Pack completed challenge ids into the fixed-width bitfield.
 *
 * Fixed width matters: a document that never changes size pays no storage on update,
 * only processing. A growing list would pay storage on every write.
 */
export function encodeCompletion(completed: Iterable<ChallengeId>): Uint8Array {
  const bytes = new Uint8Array(PROGRESS_BITFIELD_BYTES);
  for (const id of completed) {
    const slot = challengeSlots[id];
    if (slot === undefined) continue;
    bytes[slot >> 3] |= 1 << (slot & 7);
  }
  return bytes;
}

/**
 * Unpack the bitfield back into challenge ids.
 *
 * Iterates the slot map rather than the raw bits, so retired slots and bits set by a newer
 * client are ignored without any separate active-slot mask to keep in sync.
 */
export function decodeCompletion(bytes: Uint8Array): Set<ChallengeId> {
  const completed = new Set<ChallengeId>();
  for (const [id, slot] of Object.entries(challengeSlots) as [ChallengeId, number][]) {
    if (bytes.length > slot >> 3 && bytes[slot >> 3] & (1 << (slot & 7))) completed.add(id);
  }
  return completed;
}

/** Every challenge that still exists, i.e. has a slot and a spec. */
export function activeChallengeIds(): ChallengeId[] {
  return (Object.keys(challengeSlots) as ChallengeId[]).filter((id) => challengeSpecs[id]);
}
