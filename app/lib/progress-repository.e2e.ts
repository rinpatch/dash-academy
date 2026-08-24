import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChallengeId } from "@/lib/progress";
import type { ProgressWriteStrategy, StoredProgress } from "@/app/lib/progress-repository";

// A file survives Next.js development reloads and server worker boundaries.

type E2ERecord = {
  documentId: string;
  revision: string;
  completed: ChallengeId[];
  credentialPublicKey: string;
};

type E2EStore = { records: Record<string, E2ERecord> };

function storePath(): string | null {
  const value = process.env.DASH_ACADEMY_E2E_STORE;
  if (!value) return null;
  if (!path.isAbsolute(value)) throw new Error("DASH_ACADEMY_E2E_STORE must be an absolute path");
  return value;
}

async function readStore(file: string): Promise<E2EStore> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as E2EStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { records: {} };
    throw error;
  }
}

async function writeStore(file: string, store: E2EStore): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

function fromRecord(record: E2ERecord): StoredProgress {
  return {
    documentId: record.documentId,
    revision: BigInt(record.revision),
    completed: new Set(record.completed),
    credentialPublicKey: new Uint8Array(Buffer.from(record.credentialPublicKey, "base64")),
  };
}

export async function fetchE2EProgress(
  key: Uint8Array,
): Promise<StoredProgress | null | undefined> {
  const file = storePath();
  if (!file) return undefined;
  const record = (await readStore(file)).records[Buffer.from(key).toString("hex")];
  return record ? fromRecord(record) : null;
}

export async function saveE2EProgress(
  key: Uint8Array,
  completed: Iterable<ChallengeId>,
  credentialPublicKey?: Uint8Array,
  strategy: ProgressWriteStrategy = "merge",
): Promise<StoredProgress | undefined> {
  const file = storePath();
  if (!file) return undefined;

  const store = await readStore(file);
  const keyHex = Buffer.from(key).toString("hex");
  const existing = store.records[keyHex];
  const publicKey = existing?.credentialPublicKey
    ? new Uint8Array(Buffer.from(existing.credentialPublicKey, "base64"))
    : credentialPublicKey;
  if (!publicKey?.length) {
    throw new Error("Cannot create a progress document without the passkey public key");
  }

  const incoming = new Set(completed);
  const next =
    strategy === "merge"
      ? new Set<ChallengeId>([...(existing?.completed ?? []), ...incoming])
      : incoming;
  if (
    existing &&
    next.size === existing.completed.length &&
    [...next].every((id) => existing.completed.includes(id))
  ) {
    return fromRecord(existing);
  }

  const record: E2ERecord = {
    documentId: existing?.documentId ?? randomBytes(32).toString("hex"),
    revision: (BigInt(existing?.revision ?? "0") + BigInt(1)).toString(),
    completed: [...next],
    credentialPublicKey: Buffer.from(publicKey).toString("base64"),
  };
  store.records[keyHex] = record;
  await writeStore(file, store);
  return fromRecord(record);
}
