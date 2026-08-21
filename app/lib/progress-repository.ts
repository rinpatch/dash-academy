import "server-only";
import { randomBytes } from "node:crypto";
import type { ChallengeId } from "@/lib/progress";
import {
  PROGRESS_BITFIELD_BYTES,
  PROGRESS_DOCUMENT_VERSION,
  decodeCompletion,
  encodeCompletion,
} from "@/lib/progress/slots";
import { getAcademySigner, resetAcademySigner } from "@/app/lib/platform";
import { fetchE2EProgress, saveE2EProgress } from "@/app/lib/progress-repository.e2e";

const DOCUMENT_TYPE = "progress";

export type StoredProgress = {
  documentId: string;
  revision: bigint;
  completed: Set<ChallengeId>;
  /** COSE public key of the learner's passkey, used to verify their assertions. */
  credentialPublicKey: Uint8Array;
};

/**
 * byteArray fields are asymmetric, and neither direction is what the SDK examples suggest:
 * writes go through Document.fromObject with raw bytes (`new Document({ properties })`
 * silently mangles them into an integer array and fails deep in storage), while `where`
 * clauses match on base64. Reads come back as Uint8Array.
 */
function toQueryValue(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Runs `operation`, retrying once on a retriable failure with a rebuilt client. */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error as { isRetriable?: boolean })?.isRetriable) throw error;
    resetAcademySigner();
    return operation();
  }
}

export async function fetchProgress(key: Uint8Array): Promise<StoredProgress | null> {
  const local = await fetchE2EProgress(key);
  if (local !== undefined) return local;

  const pending = getAcademySigner();
  if (!pending) return null;
  const { sdk, config } = await pending;

  return withRetry(async () => {
    const results = await sdk.documents.query({
      dataContractId: config.contractId,
      documentTypeName: DOCUMENT_TYPE,
      where: [["learnerKey", "==", toQueryValue(key)]],
      limit: 1,
    });

    for (const document of results.values()) {
      if (!document) continue;
      // Read $id off the Document rather than toObject(), which hands back raw bytes whose
      // toString() is a list of numbers, not the base58 id.
      const object = document.toObject() as unknown as {
        $revision?: bigint;
        completed?: Uint8Array;
        credentialPublicKey?: Uint8Array;
      };
      return {
        documentId: document.id.toString(),
        revision: object.$revision ?? BigInt(1),
        completed: decodeCompletion(object.completed ?? new Uint8Array(PROGRESS_BITFIELD_BYTES)),
        credentialPublicKey: object.credentialPublicKey ?? new Uint8Array(),
      };
    }
    return null;
  });
}

/**
 * Writes the completion set: creates on first sync, replaces after. The bitfield is fixed
 * width, so a replace changes no bytes and pays processing but no storage.
 *
 * Unions rather than overwrites — a stale client can't erase progress made elsewhere.
 */
export async function saveProgress(
  key: Uint8Array,
  completed: Iterable<ChallengeId>,
  credentialPublicKey?: Uint8Array,
): Promise<StoredProgress | null> {
  const local = await saveE2EProgress(key, completed, credentialPublicKey);
  if (local !== undefined) return local;

  const pending = getAcademySigner();
  if (!pending) return null;
  const { sdk, signer, identityKey, config } = await pending;
  const { Document } = await import("@dashevo/evo-sdk");

  return withRetry(async () => {
    const existing = await fetchProgress(key);
    const merged = new Set<ChallengeId>([...(existing?.completed ?? []), ...completed]);
    const now = BigInt(Date.now());

    const publicKey = existing?.credentialPublicKey ?? credentialPublicKey;
    if (!publicKey?.length) {
      // Without it the learner could never authenticate again, stranding the record.
      throw new Error("Cannot create a progress document without the passkey public key");
    }

    // The contract requires both timestamps, so they have to be set explicitly or the
    // document fails to serialize before it ever reaches the network.
    const base = {
      $formatVersion: "0",
      $ownerId: config.identityId,
      $dataContractId: config.contractId,
      $type: DOCUMENT_TYPE,
      $updatedAt: now,
      learnerKey: key,
      version: PROGRESS_DOCUMENT_VERSION,
      completed: encodeCompletion(merged),
      credentialPublicKey: publicKey,
    };

    if (!existing) {
      const entropy = new Uint8Array(randomBytes(32));
      const document = Document.fromObject(
        {
          ...base,
          $id: Document.generateId(DOCUMENT_TYPE, config.identityId, config.contractId, entropy),
          $entropy: entropy,
          $revision: BigInt(1),
          $createdAt: now,
        } as never,
        null as never,
      );
      await sdk.documents.create({ document, identityKey, signer });
      return {
        documentId: document.id.toString(),
        revision: BigInt(1),
        completed: merged,
        credentialPublicKey: publicKey,
      };
    }

    const revision = existing.revision + BigInt(1);
    const document = Document.fromObject(
      { ...base, $id: existing.documentId, $revision: revision, $createdAt: now } as never,
      null as never,
    );
    await sdk.documents.replace({ document, identityKey, signer });
    return {
      documentId: existing.documentId,
      revision,
      completed: merged,
      credentialPublicKey: publicKey,
    };
  });
}
