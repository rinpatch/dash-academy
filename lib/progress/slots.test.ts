import assert from "node:assert/strict";
import { test } from "vitest";
import type { ChallengeId } from "@/lib/progress";
import { challengeSpecs } from "@/lib/progress";
import {
  PROGRESS_BITFIELD_BYTES,
  activeChallengeIds,
  challengeSlots,
  decodeCompletion,
  encodeCompletion,
  retiredSlots,
} from "@/lib/progress/slots";

/**
 * The slot map is a wire format. These tests exist to make the ways it can silently corrupt
 * stored progress into loud build failures instead.
 */

// Frozen on 2026-08-20. Adding a challenge appends a line; nothing else may ever change.
// If a diff here moves an existing number, stop: it rewrites history for every learner.
const SLOT_SNAPSHOT: Record<string, number> = {
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
};

test("no slot number is ever assigned twice, including to retired challenges", () => {
  const seen = new Map<number, string>();
  for (const [id, slot] of Object.entries(challengeSlots)) {
    assert.equal(seen.get(slot), undefined, `slot ${slot} used by both ${seen.get(slot)} and ${id}`);
    seen.set(slot, id);
  }
  for (const [slot, id] of Object.entries(retiredSlots)) {
    const number = Number(slot);
    assert.equal(seen.get(number), undefined, `retired slot ${number} was reissued to ${seen.get(number)}`);
    seen.set(number, id);
  }
});

test("existing slot numbers never move", () => {
  for (const [id, slot] of Object.entries(SLOT_SNAPSHOT)) {
    assert.equal(
      (challengeSlots as Record<string, number>)[id],
      slot,
      `${id} moved from slot ${slot} — this reinterprets every stored document`,
    );
  }
});

test("every challenge with a spec has a slot, and vice versa", () => {
  for (const id of Object.keys(challengeSpecs)) {
    assert.notEqual((challengeSlots as Record<string, number>)[id], undefined, `${id} has no slot`);
  }
  for (const id of Object.keys(challengeSlots)) {
    assert.ok(challengeSpecs[id as ChallengeId], `${id} has a slot but no spec — retire it properly`);
  }
});

test("the bitfield is wide enough for every slot", () => {
  const highest = Math.max(
    ...Object.values(challengeSlots),
    ...Object.keys(retiredSlots).map(Number),
    0,
  );
  assert.ok(highest < PROGRESS_BITFIELD_BYTES * 8, `slot ${highest} overflows the bitfield`);
});

test("encode then decode round-trips", () => {
  const completed: ChallengeId[] = ["what-is-dash", "tokens", "query-documents:quiz"];
  assert.deepEqual(decodeCompletion(encodeCompletion(completed)), new Set(completed));
});

test("encoding is fixed width regardless of how much is completed", () => {
  assert.equal(encodeCompletion([]).length, PROGRESS_BITFIELD_BYTES);
  assert.equal(encodeCompletion(activeChallengeIds()).length, PROGRESS_BITFIELD_BYTES);
});

test("an empty bitfield decodes to no progress", () => {
  assert.equal(decodeCompletion(new Uint8Array(PROGRESS_BITFIELD_BYTES)).size, 0);
});

test("bits outside the known slot map are ignored rather than crashing", () => {
  const bytes = encodeCompletion(["what-is-dash"]);
  bytes[3] |= 0b1000_0000; // slot 31: a challenge only a newer client knows about
  assert.deepEqual(decodeCompletion(bytes), new Set(["what-is-dash"]));
});

test("a short bitfield from an older client decodes without throwing", () => {
  assert.deepEqual(decodeCompletion(new Uint8Array([0b0000_0001])), new Set(["what-is-dash"]));
});
