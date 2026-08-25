import "server-only";
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

export type ProgressWriteStrategy = "merge" | "replace";

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
  const { sdk, Document, config } = await pending;

  return withRetry(async () => {
    const documentId = Document.generateId(
      DOCUMENT_TYPE,
      config.identityId,
      config.contractId,
      key,
    );
    const document = await sdk.documents.get(config.contractId, DOCUMENT_TYPE, documentId);
    if (!document) return null;

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
  });
}

/**
 * Writes the completion set: creates on first sync, replaces after. The bitfield is fixed
 * width, so a replace changes no bytes and pays processing but no storage.
 *
 * Normal background writes union so a stale client cannot erase progress made elsewhere.
 * Replacing is reserved for the explicit conflict choice made during passkey sign-in.
 */
export async function saveProgress(
  key: Uint8Array,
  completed: Iterable<ChallengeId>,
  credentialPublicKey?: Uint8Array,
  strategy: ProgressWriteStrategy = "merge",
): Promise<StoredProgress | null> {
  const local = await saveE2EProgress(key, completed, credentialPublicKey, strategy);
  if (local !== undefined) return local;

  const pending = getAcademySigner();
  if (!pending) return null;
  const { sdk, signer, identityKey, Document, config } = await pending;

  return withRetry(async () => {
    const existing = await fetchProgress(key);
    const incoming = new Set(completed);
    const next =
      strategy === "merge"
        ? new Set<ChallengeId>([...(existing?.completed ?? []), ...incoming])
        : incoming;
    if (
      existing &&
      next.size === existing.completed.size &&
      [...next].every((id) => existing.completed.has(id))
    ) {
      return existing;
    }
    const publicKey = existing?.credentialPublicKey ?? credentialPublicKey;
    if (!publicKey?.length) {
      // Without it the learner could never authenticate again, stranding the record.
      throw new Error("Cannot create a progress document without the passkey public key");
    }

    const base = {
      $formatVersion: "0",
      $ownerId: config.identityId,
      $dataContractId: config.contractId,
      $type: DOCUMENT_TYPE,
      version: PROGRESS_DOCUMENT_VERSION,
      completed: encodeCompletion(next),
      credentialPublicKey: publicKey,
    };

    if (!existing) {
      const document = Document.fromObject(
        {
          ...base,
          $id: Document.generateId(DOCUMENT_TYPE, config.identityId, config.contractId, key),
          $entropy: key,
          $revision: BigInt(1),
        } as never,
        null as never,
      );
      await sdk.documents.create({ document, identityKey, signer });
      return {
        documentId: document.id.toString(),
        revision: BigInt(1),
        completed: next,
        credentialPublicKey: publicKey,
      };
    }

    const revision = existing.revision + BigInt(1);
    const document = Document.fromObject(
      { ...base, $id: existing.documentId, $revision: revision } as never,
      null as never,
    );
    await sdk.documents.replace({ document, identityKey, signer });
    return {
      documentId: existing.documentId,
      revision,
      completed: next,
      credentialPublicKey: publicKey,
    };
  });
}
