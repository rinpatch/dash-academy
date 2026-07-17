export type QuizEvidence = {
  score: number;
  total: number;
  answers: Record<string, string>;
};

export type ChallengeEvidenceMap = {
  "what-is-dash-platform": QuizEvidence;
  "create-a-dash-identity": { identityId: string };
};

export type ChallengeId = keyof ChallengeEvidenceMap;

export type QuizChallengeId = {
  [K in ChallengeId]: ChallengeEvidenceMap[K] extends QuizEvidence ? K : never;
}[ChallengeId];

export type ChallengeCompletion<K extends ChallengeId = ChallengeId> = {
  completedAt: string;
  evidence: ChallengeEvidenceMap[K];
};

export type CompletedChallenges = {
  [K in ChallengeId]?: ChallengeCompletion<K>;
};

export function withCompletedChallenge<K extends ChallengeId>(
  completedChallenges: CompletedChallenges,
  challengeId: K,
  evidence: ChallengeEvidenceMap[K],
  completedAt = new Date().toISOString(),
): CompletedChallenges {
  const completion: ChallengeCompletion<K> = {
    completedAt: completedChallenges[challengeId]?.completedAt ?? completedAt,
    evidence,
  };

  return {
    ...completedChallenges,
    [challengeId]: completion,
  };
}

export function parseCompletedChallenges(value: unknown): CompletedChallenges {
  const completedChallenges: CompletedChallenges = {};
  if (!isRecord(value)) return completedChallenges;

  const quizChallenge = value["what-is-dash-platform"];

  if (
    isRecord(quizChallenge) &&
    typeof quizChallenge.completedAt === "string" &&
    isRecord(quizChallenge.evidence) &&
    typeof quizChallenge.evidence.score === "number" &&
    typeof quizChallenge.evidence.total === "number" &&
    isStringRecord(quizChallenge.evidence.answers)
  ) {
    completedChallenges["what-is-dash-platform"] = {
      completedAt: quizChallenge.completedAt,
      evidence: {
        score: quizChallenge.evidence.score,
        total: quizChallenge.evidence.total,
        answers: quizChallenge.evidence.answers,
      },
    };
  }

  const identityChallenge = value["create-a-dash-identity"];

  if (
    isRecord(identityChallenge) &&
    typeof identityChallenge.completedAt === "string" &&
    isRecord(identityChallenge.evidence) &&
    typeof identityChallenge.evidence.identityId === "string"
  ) {
    completedChallenges["create-a-dash-identity"] = {
      completedAt: identityChallenge.completedAt,
      evidence: { identityId: identityChallenge.evidence.identityId },
    };
  }

  return completedChallenges;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}
