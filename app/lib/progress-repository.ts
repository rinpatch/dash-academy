import "server-only";
import type { ChallengeId } from "@/lib/progress";
import {
  PROGRESS_BITFIELD_BYTES,
  PROGRESS_DOCUMENT_VERSION,
  decodeCompletion,
  encodeCompletion,
} from "@/lib/progress/slots";
import { getAcademySigner, resetAcademySigner } from "@/app/lib/platform";

const DOCUMENT_TYPE = "progress";

export type StoredProgress = {
  documentId: string;
  revision: bigint;
  completed: Set<ChallengeId>;
};

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
  const pending = getAcademySigner();
  if (!pending) return null;
  const { sdk, config } = await pending;

  return withRetry(async () => {
    const results = await sdk.documents.query({
      dataContractId: config.contractId,
      documentTypeName: DOCUMENT_TYPE,
      where: [["learnerKey", "==", key]],
      limit: 1,
    });

    for (const document of results.values()) {
      if (!document) continue;
      const object = document.toObject() as unknown as {
        $id: { toString(): string };
        $revision?: bigint;
        completed?: Uint8Array;
      };
      return {
        documentId: object.$id.toString(),
        revision: object.$revision ?? BigInt(1),
        completed: decodeCompletion(object.completed ?? new Uint8Array(PROGRESS_BITFIELD_BYTES)),
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
): Promise<StoredProgress | null> {
  const pending = getAcademySigner();
  if (!pending) return null;
  const { sdk, signer, identityKey, config } = await pending;
  const { Document } = await import("@dashevo/evo-sdk");

  return withRetry(async () => {
    const existing = await fetchProgress(key);
    const merged = new Set<ChallengeId>([...(existing?.completed ?? []), ...completed]);

    const properties = {
      learnerKey: key,
      version: PROGRESS_DOCUMENT_VERSION,
      completed: encodeCompletion(merged),
    };

    if (!existing) {
      const document = new Document({
        properties,
        documentTypeName: DOCUMENT_TYPE,
        dataContractId: config.contractId,
        ownerId: config.identityId,
      });
      await sdk.documents.create({ document, identityKey, signer });
      return {
        documentId: document.id.toString(),
        revision: BigInt(1),
        completed: merged,
      };
    }

    const revision = existing.revision + BigInt(1);
    const document = new Document({
      properties,
      documentTypeName: DOCUMENT_TYPE,
      dataContractId: config.contractId,
      ownerId: config.identityId,
      id: existing.documentId,
      revision,
    });
    await sdk.documents.replace({ document, identityKey, signer });
    return {
      documentId: existing.documentId,
      revision,
      completed: merged,
    };
  });
}
