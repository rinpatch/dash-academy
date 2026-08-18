export type QuizEvidence = {
  score: number;
  total: number;
  answers: Record<string, string>;
};

export type TestnetEvidence = { reference: string };
export type IdentityEvidence = { identityId: string };

export const challengeSpecs = {
  "what-is-dash-platform": { lessonId: "what-is-dash-platform", evidence: "quiz", completesLesson: true },
  "why-build-on-dash": { lessonId: "why-build-on-dash", evidence: "quiz", completesLesson: true },
  identities: { lessonId: "identities", evidence: "quiz", completesLesson: true },
  "data-contracts": { lessonId: "data-contracts", evidence: "quiz", completesLesson: true },
  documents: { lessonId: "documents", evidence: "quiz", completesLesson: true },
  dapi: { lessonId: "dapi", evidence: "quiz", completesLesson: true },
  proofs: { lessonId: "proofs", evidence: "quiz", completesLesson: true },
  "environment-setup": { lessonId: "environment-setup", evidence: "testnet", completesLesson: true },
  "fund-a-platform-address": { lessonId: "fund-a-platform-address", evidence: "testnet", completesLesson: true },
  "create-a-dash-identity": { lessonId: "create-a-dash-identity", evidence: "identity", completesLesson: true },
  "register-a-username": { lessonId: "register-a-username", evidence: "testnet", completesLesson: true },
  "write-your-first-data-contract:quiz": { lessonId: "write-your-first-data-contract", evidence: "quiz", completesLesson: false },
  "write-your-first-data-contract": { lessonId: "write-your-first-data-contract", evidence: "testnet", completesLesson: true },
  "submit-a-document": { lessonId: "submit-a-document", evidence: "testnet", completesLesson: true },
  "query-documents:quiz": { lessonId: "query-documents", evidence: "quiz", completesLesson: false },
  "query-documents": { lessonId: "query-documents", evidence: "testnet", completesLesson: true },
  "document-transfer-and-purchase:quiz": { lessonId: "document-transfer-and-purchase", evidence: "quiz", completesLesson: false },
  "document-transfer-and-purchase": { lessonId: "document-transfer-and-purchase", evidence: "testnet", completesLesson: true },
  "tokens:quiz": { lessonId: "tokens", evidence: "quiz", completesLesson: false },
  tokens: { lessonId: "tokens", evidence: "testnet", completesLesson: true },
  "token-paid-document-creation:quiz": { lessonId: "token-paid-document-creation", evidence: "quiz", completesLesson: false },
  "token-paid-document-creation": { lessonId: "token-paid-document-creation", evidence: "testnet", completesLesson: true },
} as const;

export type ChallengeId = keyof typeof challengeSpecs;
type EvidenceKind<K extends ChallengeId> = (typeof challengeSpecs)[K]["evidence"];
type EvidenceFor<K extends ChallengeId> = EvidenceKind<K> extends "quiz"
  ? QuizEvidence
  : EvidenceKind<K> extends "identity"
    ? IdentityEvidence
    : TestnetEvidence;

export type ChallengeEvidenceMap = { [K in ChallengeId]: EvidenceFor<K> };
export type QuizChallengeId = { [K in ChallengeId]: EvidenceKind<K> extends "quiz" ? K : never }[ChallengeId];
export type ChallengeCompletion<K extends ChallengeId = ChallengeId> = {
  completedAt: string;
  evidence: ChallengeEvidenceMap[K];
};
export type CompletedChallenges = { [K in ChallengeId]?: ChallengeCompletion<K> };

export function withCompletedChallenge<K extends ChallengeId>(
  completedChallenges: CompletedChallenges,
  challengeId: K,
  evidence: ChallengeEvidenceMap[K],
  completedAt = new Date().toISOString(),
): CompletedChallenges {
  return {
    ...completedChallenges,
    [challengeId]: { completedAt: completedChallenges[challengeId]?.completedAt ?? completedAt, evidence },
  };
}

export function getCompletedLessonIds(completed: CompletedChallenges): Set<string> {
  return new Set(
    (Object.keys(completed) as ChallengeId[])
      .filter((id) => challengeSpecs[id]?.completesLesson)
      .map((id) => challengeSpecs[id].lessonId),
  );
}

export function parseCompletedChallenges(value: unknown): CompletedChallenges {
  const parsed: CompletedChallenges = {};
  if (!isRecord(value)) return parsed;

  for (const id of Object.keys(challengeSpecs) as ChallengeId[]) {
    const candidate = value[id];
    if (!isRecord(candidate) || typeof candidate.completedAt !== "string" || !isRecord(candidate.evidence)) continue;
    const kind = challengeSpecs[id].evidence;
    const valid =
      (kind === "quiz" && typeof candidate.evidence.score === "number" && typeof candidate.evidence.total === "number" && isStringRecord(candidate.evidence.answers)) ||
      (kind === "identity" && typeof candidate.evidence.identityId === "string") ||
      (kind === "testnet" && typeof candidate.evidence.reference === "string");
    if (valid) (parsed as Record<string, unknown>)[id] = candidate;
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}
